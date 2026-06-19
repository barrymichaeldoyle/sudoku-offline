# Sudoku Mobile App — MVP Handoff

> Source of truth for MVP scope, architecture, and acceptance criteria.
> Offline-first classic 9x9 Sudoku built with Expo. No backend for MVP.

## Locked Decisions (2026-06-18)
These override the original handoff where they conflict:
- **Daily puzzle:** deterministic index over a bundled pool (`daysSinceEpoch % count`),
  not dated puzzles. `date_key` is used only for streak/progress tracking, never for
  puzzle selection. App therefore has dailies for any future date, forever, offline.
- **Game lifecycle:** on completion set `games.status = "completed"` and keep the row;
  "Continue" only resumes `active`/`paused` games.
- **Input modes:** ship both cell-first and number-first from the start, switchable via a
  Settings `inputMode` toggle; input handler abstracts over the mode.
- **Mistakes:** `mistakes` always increments when a placed value disagrees with the
  solution (historical record for stats). `mistakeCheckingEnabled` only controls whether
  the mistake is *visually* flagged live.
- **No runtime generator:** drop `domain/sudoku/generator.ts` for MVP. Keep `solver.ts`
  as a lightweight candidate/constraint helper for hints only. Any generation is a
  build-time script, not bundled into the app.
- **SDK:** target Expo SDK 56; use the modern `expo-sqlite` async API
  (`openDatabaseAsync`, `runAsync`, `getAllAsync`), not the deprecated callback API.

## Project Goal
Build an offline-first Sudoku mobile app using Expo. Polished, classic 9x9 with great
input UX, offline-first play, bundled puzzle library, daily puzzle, stats, settings, and
respectful monetisation hooks (ads only after completion; one-time "Remove Ads" later).

Core product promise: **A fast, clean Sudoku app that respects your concentration.**

## Tech Stack
- Expo + React Native + TypeScript
- Expo Router (folder structure below assumes it)
- SQLite via `expo-sqlite` for durable local data
- Zustand (or similar) for in-memory UI/game state
- `expo-haptics` for feedback
- `expo-application` for install/device IDs if needed
- No backend for MVP — fully offline

## MVP Scope

### In scope
- **Gameplay:** classic 9x9 only; new puzzle by difficulty (easy/medium/hard/expert);
  cell-first input (number-first if simple); pencil notes; undo; eraser; timer with
  pause/resume; mistake-checking toggle; highlight selected row/col/box; highlight same
  numbers; duplicate warning; auto-save; completion detection; haptics.
- **Puzzles:** bundled static packs; local SQLite import on first launch; unique IDs;
  81-char string format; deterministic daily puzzle that works offline.
- **Retention:** daily puzzle; daily streak; completion screen; basic stats; shareable
  result text.
- **Settings:** dark/light/system theme; toggle timer; toggle mistake checking; toggle
  same-number highlighting; toggle haptics; toggle auto-note cleanup; reset stats (dev).
- **Monetisation hooks (stubs):** **no forced ads** — no interstitials or banners, ever.
  Only user-initiated rewarded ads (extra hint, plus planned streak-restore / challenge
  unlock); Premium ("Remove Ads") entitlement skips those and grants the perks free; no
  gameplay dependency on network.
- **Analytics:** local offline event queue only. Events: `app_opened`, `puzzle_started`,
  `puzzle_completed`, `puzzle_abandoned`, `hint_used`, `daily_started`, `daily_completed`,
  `setting_changed`, `share_result_tapped`.

### Out of scope (MVP)
Camera scanner, Killer/Jigsaw variants, multiplayer, leaderboards, login/accounts, cloud
sync, subscriptions, remote puzzle fetching, complex shop, customisation, full logic
explanation engine, backend.

## Offline-First Principle
Local state is the source of truth. The app must not require network to open, continue a
game, start a puzzle, play daily, complete, view stats, change settings, use basic hints,
or read cached premium/remove-ads state. Network features are optional side effects.

Boot flow: open DB → run migrations → import bundled packs if needed → load settings →
load active game if present → render → (later, background) sync analytics, refresh
purchases, load ads, fetch remote config. No spinner blocks gameplay on network.

## Folder Structure
```
src/
  app/                _layout.tsx, index.tsx, game/[gameId].tsx, settings.tsx, stats.tsx
  components/         Board/SudokuBoard.tsx, Board/SudokuCell.tsx, GameControls.tsx,
                      NumberPad.tsx, CompletionModal.tsx
  domain/sudoku/      types.ts, board.ts, validation.ts, notes.ts, hints.ts,
                      generator.ts, solver.ts
  data/db/            client.ts, schema.ts, migrations.ts
  data/repositories/  puzzleRepository.ts, gameRepository.ts, statsRepository.ts,
                      settingsRepository.ts, eventRepository.ts, entitlementRepository.ts
  services/           gameService.ts, dailyService.ts, hintService.ts, statsService.ts,
                      analyticsService.ts, adService.ts, purchaseService.ts,
                      networkService.ts
  state/              useGameStore.ts, useSettingsStore.ts, useThemeStore.ts,
                      useEntitlementStore.ts
  assets/puzzles/     easy.json, medium.json, hard.json, expert.json, daily.json
```

## Core Domain Types
```ts
export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type Puzzle = {
  id: string;
  difficulty: Difficulty;
  givens: string;
  solution: string;
  source: "bundled" | "downloaded" | "generated";
  dateKey?: string | null;
};

export type CellValue = number | null;
export type NoteMask = number;            // note 1 = bit 0 ... note 9 = bit 8
export type GameStatus = "active" | "paused" | "completed" | "abandoned";

export type GameState = {
  id: string; puzzleId: string; difficulty: Difficulty;
  givens: string; solution: string;
  values: CellValue[]; notes: NoteMask[];
  status: GameStatus; elapsedSeconds: number;
  mistakes: number; hintsUsed: number;
  startedAt: string; completedAt: string | null; updatedAt: string;
};

export type GameAction =
  | { type: "place_value"; cellIndex: number; previousValue: CellValue; nextValue: CellValue; previousNotes: NoteMask; nextNotes: NoteMask; }
  | { type: "set_notes"; cellIndex: number; previousNotes: NoteMask; nextNotes: NoteMask; }
  | { type: "erase"; cellIndex: number; previousValue: CellValue; previousNotes: NoteMask; };

export type Settings = {
  theme: "system" | "light" | "dark";
  timerEnabled: boolean;
  mistakeCheckingEnabled: boolean;
  highlightSameNumbers: boolean;
  highlightPeers: boolean;
  hapticsEnabled: boolean;
  autoNoteCleanup: boolean;
};

const noteMaskForNumber = (num: number) => 1 << (num - 1);
```

## Puzzle Format
81-char strings, `0` = empty. `givens.length === 81`, `solution.length === 81`. Givens
digits 0-9, solution digits 1-9. Given cells immutable; solution must match givens where
givens are non-zero.

## SQLite Schema
Tables (see migrations): `schema_meta`, `puzzle_packs`, `puzzles`, `games`,
`completed_games`, `settings`, `daily_progress`, `pending_events`, `entitlements`.
`completed_games` is the source of truth for stats.

```sql
CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS puzzle_packs (id TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL, imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS puzzles (id TEXT PRIMARY KEY NOT NULL, difficulty TEXT NOT NULL, givens TEXT NOT NULL, solution TEXT NOT NULL, source TEXT NOT NULL, date_key TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY NOT NULL, puzzle_id TEXT NOT NULL, difficulty TEXT NOT NULL, givens TEXT NOT NULL, solution TEXT NOT NULL, values_string TEXT NOT NULL, notes_json TEXT NOT NULL, status TEXT NOT NULL, elapsed_seconds INTEGER NOT NULL, mistakes INTEGER NOT NULL, hints_used INTEGER NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS completed_games (id TEXT PRIMARY KEY NOT NULL, game_id TEXT NOT NULL, puzzle_id TEXT NOT NULL, difficulty TEXT NOT NULL, date_key TEXT, elapsed_seconds INTEGER NOT NULL, mistakes INTEGER NOT NULL, hints_used INTEGER NOT NULL, completed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS daily_progress (date_key TEXT PRIMARY KEY NOT NULL, puzzle_id TEXT NOT NULL, game_id TEXT, completed_at TEXT, elapsed_seconds INTEGER, mistakes INTEGER, hints_used INTEGER);
CREATE TABLE IF NOT EXISTS pending_events (id TEXT PRIMARY KEY NOT NULL, event_name TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, sent_at TEXT);
CREATE TABLE IF NOT EXISTS entitlements (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, verified_at TEXT, expires_at TEXT);
```

## Board Logic (pure, React-independent)
`parseValuesString`, `valuesToString`, `isGivenCell`, `getRowIndex`, `getColIndex`,
`getBoxIndex`, `getPeerIndices`, `isValueCorrect`, `hasDuplicate`, `isPuzzleComplete`,
`cleanupNotesAfterPlacement`. Index convention: row-major 0..80.

## Game Screen UX
Header (timer, mistakes, pause) → board → number pad → controls (notes toggle, undo,
erase, hint) → optional completion modal. Cell-first interaction; notes mode toggles
note bits; erase clears value/notes; undo reverses last user-changing action. Subtle
haptics for place / invalid / complete / toggle notes (respect setting).

## Save Strategy
User action → update in-memory store immediately → debounce local SQLite save. Persist
after value/note/undo/erase/hint/pause/background/completion. Lose at most one move on
crash.

## Timer Strategy
Store `elapsed_seconds`, in-memory `last_started_at`, `status`. While active & not paused:
`displayElapsed = savedElapsed + now - lastStartedAt`. On pause/background: commit
elapsed, set paused, save. Auto-pause on background; resume only on user tap.

## Daily Puzzle
Local date key `YYYY-MM-DD`. Selection: deterministic index `daysSinceEpoch %
dailyPoolCount` over a bundled daily pool — works for any future date offline. `date_key`
records which day was played (for streak/progress), not which puzzle. Streak: based on
local calendar day; completing today updates streak; yesterday → increment; today → no
change; else reset to 1.

## Stats
Total completed; completed by difficulty; best/average time by difficulty; current &
longest daily streak; mistake-free completions. Source: `completed_games` +
`daily_progress`. Don't over-engineer caching yet.

## Hints
Find an empty non-given cell; prefer single-candidate cells if candidate logic exists;
else reveal a safe correct value from solution. Increment `hintsUsed`. Later gate behind
premium / free hints / rewarded ad — never block core offline gameplay.

## Ads & Purchases (stubs first)
```ts
export type AdService = {
  // No interstitials/banners. Only user-initiated rewarded ads.
  isRewardedHintAvailable(): Promise<boolean>;
  showRewardedHintAd(): Promise<boolean>;
};
export type PurchaseService = {
  getCachedEntitlements(): Promise<Record<string, boolean>>;
  refreshEntitlements(): Promise<void>;
  purchaseRemoveAds(): Promise<boolean>;
  restorePurchases(): Promise<void>;
};
```
**No forced ads, ever** — no interstitials, no banners, nothing during or between
puzzles. Ads are only the rewarded kind the player chooses to watch for a clear
benefit (extra hint, streak restore, challenge unlock). Premium (`remove_ads`)
removes those prompts and grants the perks free. Use cached entitlement offline.

## Analytics (local queue only)
```ts
export type AnalyticsEvent = { id: string; eventName: string; payload: Record<string, unknown>; createdAt: string; };
// track(eventName, payload?): Promise<void>;  flushPendingEvents(): Promise<void>;  // no-op for MVP
```
Gameplay never waits on analytics; failures invisible to users; cap queue eventually.

## Screens
- **Home:** Continue (if active) · Daily · New Game (Easy/Medium/Hard/Expert) · Stats · Settings.
- **Game:** board, timer, controls; smooth on small phones.
- **Completion:** difficulty, time, mistakes, hints; New Game · Daily · Share; then
  `maybeShowPostCompletionInterstitial`.
- **Stats / Settings:** simple displays and toggles.

## Visual Direction
Calm, minimal, readable. Large tap targets, clear selected cell + peer highlighting,
clear notes, dark mode. Avoid casino effects, excessive animation, tiny buttons, in-game
ads/banners.

## Build Order
1. Foundation: project, routing, SQLite, migrations, puzzle assets, import, Home.
2. Core Sudoku: domain helpers, game creation, Game screen, board, input, immutable
   givens, completion checking.
3. Game UX: notes, undo, erase, timer, pause/resume, highlighting, mistake checking,
   haptics, auto-save.
4. Retention: daily, completion screen, stats, streak, share.
5. Offline hooks: analytics queue, ad/purchase stubs, entitlement cache.
6. Polish: settings, theme, empty/error states, a11y, small-phone layout, domain tests.

## Testing Priorities
Pure domain first: index calc, peers, given detection, parse/stringify, completion,
duplicates, note bitmask toggle, auto-note cleanup, daily streak, puzzle validation.
Manual: airplane-mode first launch, kill mid-puzzle, kill after completion, background
during timer, theme change, daily completion (and twice), many new games, undo chains.

## Definition of Done
Installable and fully playable offline; puzzles imported from bundled data; progress
remembered; daily works; completion stats work; smooth & readable; settings persist;
clean service boundaries for ads/purchases/analytics; structured for future variants,
logic hints, and monetisation.

## IDs & Dates
Stable string IDs: `puzzle_easy_000001`, `daily_2026_06_18`, UUIDs for games/completions.
ISO timestamps; local `YYYY-MM-DD` daily keys.
