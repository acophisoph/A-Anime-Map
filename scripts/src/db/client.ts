import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { repoPath } from '../util/paths';

export const DB_PATH = repoPath('scripts','.cache','anime-atlas.sqlite');

export function openDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}
