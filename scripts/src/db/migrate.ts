import fs from 'node:fs';
import path from 'node:path';
import { openDb } from './client';
import { repoPath } from '../util/paths';

export function runMigrations() {
  const db = openDb();
  db.exec('CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at INTEGER)');
  const dir = repoPath('scripts','src','db','migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const has = db.prepare('SELECT id FROM migrations WHERE id = ?');
  const insert = db.prepare('INSERT INTO migrations(id, applied_at) VALUES (?,?)');
  for (const file of files) {
    if (has.get(file)) continue;
    db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
    insert.run(file, Date.now());
  }
  return db;
}
