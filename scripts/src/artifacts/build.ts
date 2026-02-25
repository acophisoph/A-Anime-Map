import fs from 'node:fs';
import path from 'node:path';
import { UMAP } from 'umap-js';
import { runMigrations } from '../db/migrate';

const db = runMigrations();
const dataDir = path.resolve('data');
fs.mkdirSync(path.join(dataDir, 'meta'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'index'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'lookup'), { recursive: true });

type Edge = { source: number; target: number; weight: number };
type Point = { id: number; kind: 0 | 1; x: number; y: number };

const media = db.prepare('SELECT * FROM media ORDER BY id').all() as any[];
const people = db.prepare('SELECT * FROM people ORDER BY id').all() as any[];
const credits = db.prepare('SELECT * FROM credits').all() as any[];

function buildFeatures() {
  const tagSet = new Set<string>();
  for (const m of media) {
    JSON.parse(m.genres_json || '[]').forEach((g: string) => tagSet.add(`g:${g}`));
    JSON.parse(m.tags_json || '[]').forEach((t: any) => tagSet.add(`t:${t.name}`));
  }
  const tags = [...tagSet].sort();
  const idx = new Map(tags.map((t, i) => [t, i]));
  const mediaFeats = media.map((m) => {
    const v = Array(tags.length).fill(0);
    JSON.parse(m.genres_json || '[]').forEach((g: string) => (v[idx.get(`g:${g}`)!] = 1));
    JSON.parse(m.tags_json || '[]').forEach((t: any) => (v[idx.get(`t:${t.name}`)!] = Math.max((t.rank ?? 50) / 100, 0.2)));
    return v;
  });
  return mediaFeats;
}

function fallbackCoords(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const r = Math.sqrt(i + 1) / Math.sqrt(n + 1);
    const a = i * 2.399963229728653;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

const mediaFeats = buildFeatures();
const mediaCoords = media.length < 200 ? fallbackCoords(media.length) : new UMAP({ nComponents: 2, random: () => 0.42 as any }).fit(mediaFeats);
const mediaCoordMap = new Map(media.map((m, i) => [m.id, mediaCoords[i]]));

const peopleCoords = people.map((p, i) => {
  const appearances = credits.filter((c) => c.person_id === p.id && c.is_localization === 0);
  if (appearances.length === 0) return fallbackCoords(people.length)[i];
  const sum = appearances.reduce((acc, c) => {
    const [x, y] = mediaCoordMap.get(c.media_id) ?? [0, 0];
    return [acc[0] + x * c.weight, acc[1] + y * c.weight, acc[2] + c.weight] as [number, number, number];
  }, [0, 0, 0] as [number, number, number]);
  return [sum[0] / (sum[2] || 1), sum[1] / (sum[2] || 1)];
});

const points: Point[] = [
  ...media.map((m, i) => ({ id: m.id, kind: 0 as const, x: mediaCoords[i][0], y: mediaCoords[i][1] })),
  ...people.map((p, i) => ({ id: p.id, kind: 1 as const, x: peopleCoords[i][0], y: peopleCoords[i][1] })),
];
fs.writeFileSync(path.join(dataDir, 'points.json'), JSON.stringify({ version: 1, points }));

const mediaRelations: Edge[] = db
  .prepare('SELECT media_id, related_media_id FROM media_relations ORDER BY media_id')
  .all()
  .map((r: any) => ({ source: r.media_id, target: r.related_media_id, weight: 1 }));
fs.writeFileSync(path.join(dataDir, 'graph_media_relations.json'), JSON.stringify({ version: 1, edges: mediaRelations }));

const peopleByMedia = new Map<number, any[]>();
for (const c of credits.filter((c) => c.is_localization === 0)) {
  const list = peopleByMedia.get(c.media_id) ?? [];
  list.push(c);
  peopleByMedia.set(c.media_id, list);
}

const collab = new Map<string, number>();
for (const list of peopleByMedia.values()) {
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i].person_id;
      const b = list[j].person_id;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      collab.set(key, (collab.get(key) ?? 0) + Math.min(list[i].weight, list[j].weight));
    }
  }
}
const peopleCollab: Edge[] = [...collab.entries()].map(([k, v]) => {
  const [source, target] = k.split(':').map(Number);
  return { source, target, weight: v };
});
fs.writeFileSync(path.join(dataDir, 'graph_people_collab.json'), JSON.stringify({ version: 1, edges: peopleCollab }));

const byPerson = new Map<number, any[]>();
for (const c of credits.filter((c) => c.is_localization === 0)) {
  const list = byPerson.get(c.person_id) ?? [];
  list.push(c);
  byPerson.set(c.person_id, list);
}
const mediaStaff = new Map<string, number>();
for (const list of byPerson.values()) {
  for (const a of list) {
    for (const b of list) {
      if (a.media_id >= b.media_id) continue;
      const key = `${a.media_id}:${b.media_id}`;
      mediaStaff.set(key, (mediaStaff.get(key) ?? 0) + Math.min(a.weight, b.weight));
    }
  }
}
const mediaStaffEdges: Edge[] = [...mediaStaff.entries()].map(([k, weight]) => {
  const [source, target] = k.split(':').map(Number);
  return { source, target, weight };
});
fs.writeFileSync(path.join(dataDir, 'graph_media_staff.json'), JSON.stringify({ version: 1, edges: mediaStaffEdges }));

function chunkWrite(name: 'media' | 'people', rows: any[], idKey: string) {
  const lookup: Record<string, string> = {};
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const file = `${name}_${String(i / size).padStart(5, '0')}.json`;
    fs.writeFileSync(path.join(dataDir, 'meta', file), JSON.stringify(slice));
    for (const row of slice) lookup[row[idKey]] = file;
  }
  fs.writeFileSync(path.join(dataDir, 'lookup', `${name}_to_meta_chunk.json`), JSON.stringify(lookup, null, 2));
}
chunkWrite('media', media, 'id');
chunkWrite('people', people, 'id');

const searchEntries = [
  ...media.map((m) => ({ id: m.id, kind: 'media', label_en: m.title_english || m.title_romaji || '', label_native: m.title_native || '', year: m.season_year, tags: JSON.parse(m.genres_json || '[]') })),
  ...people.map((p) => ({ id: p.id, kind: 'person', label_en: p.name_full || '', label_native: p.name_native || '' })),
];
fs.writeFileSync(path.join(dataDir, 'index/search.json'), JSON.stringify({ entries: searchEntries }));

const tagToMedia: Record<string, number[]> = {};
for (const m of media) for (const g of JSON.parse(m.genres_json || '[]')) (tagToMedia[g] = tagToMedia[g] || []).push(m.id);
fs.writeFileSync(path.join(dataDir, 'index/tag_to_media.json'), JSON.stringify(tagToMedia));

const roleToPeople: Record<string, number[]> = {};
for (const c of credits) {
  const role = String(c.role || 'Unknown').split(',')[0];
  (roleToPeople[role] = roleToPeople[role] || []).push(c.person_id);
}
fs.writeFileSync(path.join(dataDir, 'index/role_to_people.json'), JSON.stringify(roleToPeople));

const clusters = Object.entries(tagToMedia).slice(0, 30).map(([label, ids]) => {
  const pts = ids.map((id) => mediaCoordMap.get(id)).filter(Boolean) as number[][];
  const sum = pts.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return { label, x: sum[0] / Math.max(1, pts.length), y: sum[1] / Math.max(1, pts.length), size: ids.length };
});
fs.writeFileSync(path.join(dataDir, 'clusters.json'), JSON.stringify(clusters, null, 2));

const totalMedia = (db.prepare('SELECT count(*) c FROM media').get() as any).c;
const totalPeople = (db.prepare('SELECT count(*) c FROM people').get() as any).c;
const done = (db.prepare("SELECT count(*) c FROM batches WHERE status='DONE'").get() as any).c;
const pending = (db.prepare("SELECT count(*) c FROM batches WHERE status IN ('PENDING','FAILED','RUNNING')").get() as any).c;
const missingStaff = (db.prepare("SELECT count(*) c FROM media m WHERE NOT EXISTS (SELECT 1 FROM batches b WHERE b.scope_key='MEDIA_STAFF:'||m.id AND b.status='DONE')").get() as any).c;
const missingChars = (db.prepare("SELECT count(*) c FROM media m WHERE NOT EXISTS (SELECT 1 FROM batches b WHERE b.scope_key='MEDIA_CHARACTERS:'||m.id AND b.status='DONE')").get() as any).c;

fs.writeFileSync(
  path.join(dataDir, 'manifest.json'),
  JSON.stringify(
    {
      total_media_in_db: totalMedia,
      total_people_in_db: totalPeople,
      completed_batches_count: done,
      pending_batches_count: pending,
      last_ingest_run_timestamp: Date.now(),
      has_staff_for_all_media: missingStaff === 0,
      has_characters_for_all_media: missingChars === 0,
      artifact_encoding: 'json',
    },
    null,
    2,
  ),
);

console.log('artifacts built');
db.close();
