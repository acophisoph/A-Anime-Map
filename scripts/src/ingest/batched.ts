import { runMigrations } from '../db/migrate';
import { postGraphQL } from '../util/http';
import { QueryMediaCharacters, QueryMediaList, QueryMediaStaff } from './queries';
import { isLocalizationRole, roleWeight } from './roles';

const OWNER = `runner-${process.pid}-${Date.now()}`;
const LEASE_MS = 2 * 60 * 1000;
const TIME_BUDGET_MINUTES = Number(process.env.TIME_BUDGET_MINUTES ?? '30');
const RUN_BATCH_LIMIT = Number(process.env.RUN_BATCH_LIMIT ?? '8');
const BATCH_MAX_RETRIES = Number(process.env.BATCH_MAX_RETRIES ?? '5');
const LIST_PAGES = Number(process.env.LIST_PAGES ?? '50');
const PER_PAGE = 50;

const db = runMigrations();
const now = () => Date.now();

function ensureWorkPlan() {
  const insert = db.prepare('INSERT OR IGNORE INTO batches(batch_type,scope_key,status,attempts,updated_at,created_at) VALUES (?,?,?,?,?,?)');
  for (let p = 1; p <= LIST_PAGES; p += 1) {
    insert.run('ANIME_LIST', `ANIME:page:${p}`, 'PENDING', 0, now(), now());
    insert.run('MANGA_LIST', `MANGA:page:${p}`, 'PENDING', 0, now(), now());
  }
}

function acquireLease() {
  const current = db.prepare('SELECT * FROM leases WHERE name=?').get('ingest') as any;
  if (!current || current.expires_at < now()) {
    db.prepare('INSERT INTO leases(name, owner, expires_at) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner, expires_at=excluded.expires_at').run('ingest', OWNER, now() + LEASE_MS);
    return true;
  }
  return current.owner === OWNER;
}

function renewLease() {
  db.prepare('UPDATE leases SET expires_at=? WHERE name=? AND owner=?').run(now() + LEASE_MS, 'ingest', OWNER);
}

function nextBatch() {
  return db.prepare(`SELECT * FROM batches
    WHERE (status='PENDING' OR (status='FAILED' AND attempts < ?))
    ORDER BY CASE batch_type WHEN 'ANIME_LIST' THEN 1 WHEN 'MANGA_LIST' THEN 2 WHEN 'MEDIA_STAFF' THEN 3 WHEN 'MEDIA_CHARACTERS' THEN 4 ELSE 9 END, batch_id ASC
    LIMIT 1`).get(BATCH_MAX_RETRIES) as any;
}

function mark(id: number, status: string, error?: string) {
  db.prepare('UPDATE batches SET status=?, last_error=?, attempts=CASE WHEN ?=\'FAILED\' THEN attempts+1 ELSE attempts END, updated_at=? WHERE batch_id=?').run(status, error ?? null, status, now(), id);
}

async function runListBatch(batch: any, type: 'ANIME'|'MANGA') {
  const page = Number(batch.scope_key.split(':').pop());
  const data = await postGraphQL('QueryMediaList', QueryMediaList, { page, perPage: PER_PAGE, type, sort: ['POPULARITY_DESC'] });
  const tx = db.transaction(() => {
    const up = db.prepare(`INSERT INTO media(id,type,format,season_year,popularity,average_score,title_romaji,title_english,title_native,cover_large,cover_color,genres_json,tags_json,studios_json,updated_at)
      VALUES (@id,@type,@format,@seasonYear,@popularity,@averageScore,@romaji,@english,@native,@large,@color,@genres,@tags,@studios,@updated)
      ON CONFLICT(id) DO UPDATE SET type=excluded.type, format=excluded.format, season_year=excluded.season_year, popularity=excluded.popularity, average_score=excluded.average_score,
      title_romaji=excluded.title_romaji, title_english=excluded.title_english, title_native=excluded.title_native, cover_large=excluded.cover_large, cover_color=excluded.cover_color,
      genres_json=excluded.genres_json, tags_json=excluded.tags_json, studios_json=excluded.studios_json, updated_at=excluded.updated_at`);
    const rel = db.prepare('INSERT OR REPLACE INTO media_relations(media_id,related_media_id,relation_type) VALUES (?,?,?)');
    const mk = db.prepare('INSERT OR IGNORE INTO batches(batch_type,scope_key,status,attempts,updated_at,created_at) VALUES (?,?,?,?,?,?)');

    for (const m of data.Page.media) {
      up.run({
        id: m.id, type: m.type, format: m.format, seasonYear: m.seasonYear, popularity: m.popularity, averageScore: m.averageScore,
        romaji: m.title?.romaji, english: m.title?.english, native: m.title?.native,
        large: m.coverImage?.large, color: m.coverImage?.color,
        genres: JSON.stringify(m.genres ?? []), tags: JSON.stringify(m.tags ?? []), studios: JSON.stringify(m.studios?.nodes ?? []), updated: now(),
      });
      const nodes = m.relations?.nodes ?? [];
      const edges = m.relations?.edges ?? [];
      for (let i = 0; i < Math.min(nodes.length, edges.length); i += 1) {
        rel.run(m.id, nodes[i].id, edges[i].relationType ?? 'UNKNOWN');
      }
      mk.run('MEDIA_STAFF', `MEDIA_STAFF:${m.id}`, 'PENDING', 0, now(), now());
      mk.run('MEDIA_CHARACTERS', `MEDIA_CHARACTERS:${m.id}`, 'PENDING', 0, now(), now());
    }
  });
  tx();
}

async function runStaffBatch(batch: any) {
  const id = Number(batch.scope_key.split(':')[1]);
  let page = 1;
  const rows: any[] = [];
  while (true) {
    const data = await postGraphQL('QueryMediaStaff', QueryMediaStaff, { id, page, perPage: 50 });
    const s = data.Media?.staff;
    for (const edge of s?.edges ?? []) rows.push(edge);
    if (!s?.pageInfo?.hasNextPage) break;
    page += 1;
  }
  db.transaction(() => {
    const person = db.prepare(`INSERT INTO people(id,name_full,name_native,language,image_large,site_url,updated_at)
      VALUES (@id,@full,@native,@language,@image,@url,@updated)
      ON CONFLICT(id) DO UPDATE SET name_full=excluded.name_full,name_native=excluded.name_native,language=excluded.language,image_large=excluded.image_large,site_url=excluded.site_url,updated_at=excluded.updated_at`);
    const credit = db.prepare('INSERT OR REPLACE INTO credits(media_id,person_id,role,is_voice_actor,is_localization,weight) VALUES (?,?,?,?,?,?)');
    for (const edge of rows) {
      const p = edge.node;
      person.run({ id: p.id, full: p.name?.full, native: p.name?.native, language: p.languageV2, image: p.image?.large, url: p.siteUrl, updated: now() });
      const role = edge.role ?? 'Unknown';
      credit.run(id, p.id, role, 0, isLocalizationRole(role) ? 1 : 0, roleWeight(role));
    }
  })();
}

async function runCharacterBatch(batch: any) {
  const id = Number(batch.scope_key.split(':')[1]);
  let page = 1;
  const edges: any[] = [];
  while (true) {
    const data = await postGraphQL('QueryMediaCharacters', QueryMediaCharacters, { id, page, perPage: 50 });
    const c = data.Media?.characters;
    for (const edge of c?.edges ?? []) edges.push(edge);
    if (!c?.pageInfo?.hasNextPage) break;
    page += 1;
  }
  db.transaction(() => {
    const ch = db.prepare(`INSERT INTO characters(id,name_full,name_native,image_large,site_url,updated_at)
      VALUES (@id,@full,@native,@image,@url,@updated)
      ON CONFLICT(id) DO UPDATE SET name_full=excluded.name_full,name_native=excluded.name_native,image_large=excluded.image_large,site_url=excluded.site_url,updated_at=excluded.updated_at`);
    const app = db.prepare('INSERT OR REPLACE INTO character_appearances(media_id,character_id,role) VALUES (?,?,?)');
    const person = db.prepare(`INSERT INTO people(id,name_full,name_native,language,image_large,site_url,updated_at)
      VALUES (@id,@full,@native,@language,@image,@url,@updated)
      ON CONFLICT(id) DO UPDATE SET name_full=excluded.name_full,name_native=excluded.name_native,language=excluded.language,image_large=excluded.image_large,site_url=excluded.site_url,updated_at=excluded.updated_at`);
    const va = db.prepare('INSERT OR REPLACE INTO character_voice_actors(media_id,character_id,va_person_id) VALUES (?,?,?)');
    const credit = db.prepare('INSERT OR REPLACE INTO credits(media_id,person_id,role,is_voice_actor,is_localization,weight) VALUES (?,?,?,?,?,?)');
    for (const edge of edges) {
      ch.run({ id: edge.node.id, full: edge.node.name?.full, native: edge.node.name?.native, image: edge.node.image?.large, url: edge.node.siteUrl, updated: now() });
      app.run(id, edge.node.id, edge.role ?? 'Unknown');
      for (const actor of edge.voiceActors ?? []) {
        person.run({ id: actor.id, full: actor.name?.full, native: actor.name?.native, language: actor.languageV2, image: actor.image?.large, url: actor.siteUrl, updated: now() });
        va.run(id, edge.node.id, actor.id);
        credit.run(id, actor.id, `Voice Actor (${edge.node.name?.full ?? edge.node.id})`, 1, 0, 1.0);
      }
    }
  })();
}

async function main() {
  ensureWorkPlan();
  if (!acquireLease()) throw new Error('ingest lease held by another runner');
  const stopAt = now() + TIME_BUDGET_MINUTES * 60_000;
  let done = 0;
  while (now() < stopAt && done < RUN_BATCH_LIMIT) {
    renewLease();
    const batch = nextBatch();
    if (!batch) break;
    mark(batch.batch_id, 'RUNNING');
    try {
      if (batch.batch_type === 'ANIME_LIST') await runListBatch(batch, 'ANIME');
      else if (batch.batch_type === 'MANGA_LIST') await runListBatch(batch, 'MANGA');
      else if (batch.batch_type === 'MEDIA_STAFF') await runStaffBatch(batch);
      else if (batch.batch_type === 'MEDIA_CHARACTERS') await runCharacterBatch(batch);
      mark(batch.batch_id, 'DONE');
      done += 1;
      console.log(`[done] ${batch.batch_type} ${batch.scope_key}`);
    } catch (error: any) {
      mark(batch.batch_id, 'FAILED', String(error?.message ?? error));
      console.error(`[failed] ${batch.batch_type} ${batch.scope_key}:`, error?.message ?? error);
    }
  }
  console.log(`processed batches: ${done}`);
}

main().finally(() => db.close());
