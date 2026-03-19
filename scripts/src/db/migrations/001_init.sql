CREATE TABLE IF NOT EXISTS ingest_state (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS leases (
  name TEXT PRIMARY KEY,
  owner TEXT,
  expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS batches (
  batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_type TEXT,
  scope_key TEXT UNIQUE,
  status TEXT,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at INTEGER,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  type TEXT,
  format TEXT,
  season_year INTEGER,
  popularity INTEGER,
  average_score INTEGER,
  title_romaji TEXT,
  title_english TEXT,
  title_native TEXT,
  cover_large TEXT,
  cover_color TEXT,
  genres_json TEXT,
  tags_json TEXT,
  studios_json TEXT,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS media_relations (
  media_id INTEGER,
  related_media_id INTEGER,
  relation_type TEXT,
  PRIMARY KEY (media_id, related_media_id, relation_type)
);
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY,
  name_full TEXT,
  name_native TEXT,
  language TEXT,
  image_large TEXT,
  site_url TEXT,
  description TEXT,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS credits (
  media_id INTEGER,
  person_id INTEGER,
  role TEXT,
  is_voice_actor INTEGER,
  is_localization INTEGER,
  weight REAL,
  PRIMARY KEY (media_id, person_id, role, is_voice_actor)
);
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY,
  name_full TEXT,
  name_native TEXT,
  image_large TEXT,
  site_url TEXT,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS character_appearances (
  media_id INTEGER,
  character_id INTEGER,
  role TEXT,
  PRIMARY KEY (media_id, character_id)
);
CREATE TABLE IF NOT EXISTS character_voice_actors (
  media_id INTEGER,
  character_id INTEGER,
  va_person_id INTEGER,
  PRIMARY KEY (media_id, character_id, va_person_id)
);
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER
);
