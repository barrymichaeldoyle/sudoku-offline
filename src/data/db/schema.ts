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
  {
    // Add a second daily "track" (normal + challenge). daily_progress is now
    // keyed by (date_key, track); existing rows are the normal "daily" track.
    // SQLite can't alter a primary key in place, so rebuild the table.
    version: 2,
    up: `
CREATE TABLE daily_progress_v2 (
  date_key TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT 'daily',
  puzzle_id TEXT NOT NULL,
  game_id TEXT,
  completed_at TEXT,
  elapsed_seconds INTEGER,
  mistakes INTEGER,
  hints_used INTEGER,
  PRIMARY KEY (date_key, track)
);

INSERT INTO daily_progress_v2
  (date_key, track, puzzle_id, game_id, completed_at, elapsed_seconds, mistakes, hints_used)
  SELECT date_key, 'daily', puzzle_id, game_id, completed_at, elapsed_seconds, mistakes, hints_used
    FROM daily_progress;

DROP TABLE daily_progress;
ALTER TABLE daily_progress_v2 RENAME TO daily_progress;
`,
  },
  {
    // Speed up home/completion lookups that map a game back to daily progress.
    version: 3,
    up: `
CREATE INDEX IF NOT EXISTS idx_daily_progress_game_id ON daily_progress (game_id);
`,
  },
  {
    // Shared daily/challenge links open as one-offs (no daily_progress row) but
    // still need track + date metadata for labels and share links.
    version: 4,
    up: `
ALTER TABLE games ADD COLUMN shared_daily_track TEXT;
ALTER TABLE games ADD COLUMN shared_daily_date_key TEXT;
`,
  },
  {
    // Persist cells revealed by hints so rewarded clues remain visually
    // distinct and immutable after the app restarts.
    version: 5,
    up: `
ALTER TABLE games ADD COLUMN hinted_cells_json TEXT NOT NULL DEFAULT '[]';
`,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
