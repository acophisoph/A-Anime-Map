import fs from 'node:fs';
import { repoPath } from '../util/paths';

const required = [
  'manifest.json',
  'points.json',
  'graph_media_relations.json',
  'graph_media_staff.json',
  'graph_people_collab.json',
  'clusters.json',
  'index/search.json',
  'index/tag_to_media.json',
  'index/role_to_people.json',
  'lookup/media_to_meta_chunk.json',
  'lookup/people_to_meta_chunk.json',
];

for (const rel of required) {
  const abs = repoPath('data', rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing artifact ${rel}`);
}

const manifest = JSON.parse(fs.readFileSync(repoPath('data','manifest.json'), 'utf8'));
for (const key of ['total_media_in_db', 'total_people_in_db', 'completed_batches_count', 'pending_batches_count']) {
  if (typeof manifest[key] !== 'number') throw new Error(`manifest.${key} malformed`);
}

const points = JSON.parse(fs.readFileSync(repoPath('data','points.json'), 'utf8'));
if (!Array.isArray(points.points)) throw new Error('points.json malformed');

for (const graph of ['graph_media_relations.json', 'graph_media_staff.json', 'graph_people_collab.json']) {
  const payload = JSON.parse(fs.readFileSync(repoPath('data', graph), 'utf8'));
  if (!Array.isArray(payload.edges)) throw new Error(`${graph} malformed`);
}

console.log('sanity ok');
