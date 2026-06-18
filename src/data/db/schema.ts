/**
 * Schema migrations, applied in order. Each entry's `up` SQL is run inside an
 * exclusive transaction when the database's PRAGMA user_version is below its
 * `version`. Never edit a shipped migration — add a new one instead.
 */
export type Migration = {
  version: number;
  up: string;
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS puzzle_packs (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS puzzles (
  id TEXT PRIMARY KEY NOT NULL,
  difficulty TEXT NOT NULL,
  givens TEXT NOT NULL,
  solution TEXT NOT NULL,
  source TEXT NOT NULL,
  date_key TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_puzzles_difficulty ON puzzles (difficulty);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY NOT NULL,
  puzzle_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  givens TEXT NOT NULL,
  solution TEXT NOT NULL,
  values_string TEXT NOT NULL,
  notes_json TEXT NOT NULL,
  status TEXT NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  mistakes INTEGER NOT NULL,
  hints_used INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_games_status ON games (status, updated_at);

CREATE TABLE IF NOT EXISTS completed_games (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL,
  puzzle_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  date_key TEXT,
  elapsed_seconds INTEGER NOT NULL,
  mistakes INTEGER NOT NULL,
  hints_used INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_completed_difficulty ON completed_games (difficulty);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_progress (
  date_key TEXT PRIMARY KEY NOT NULL,
  puzzle_id TEXT NOT NULL,
  game_id TEXT,
  completed_at TEXT,
  elapsed_seconds INTEGER,
  mistakes INTEGER,
  hints_used INTEGER
);

CREATE TABLE IF NOT EXISTS pending_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS entitlements (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  verified_at TEXT,
  expires_at TEXT
);
`,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
