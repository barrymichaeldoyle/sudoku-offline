# Sudoku — Phase Handover

Living status doc for picking the work back up. Pairs with the full spec in
[`mvp-handoff.md`](./mvp-handoff.md) (scope, schema, acceptance criteria) and the
**Locked Decisions** section at the top of that file. Update this file as phases land.

_Last updated: end of Phase 3 (2026-06-18). Branch: work directly on `main`._

---

## How to work in this repo

- **Git:** commit directly to `main`. No feature branches. Commit/push only when asked.
- **Stack:** Expo SDK 56, Expo Router, React 19, RN 0.85, TypeScript, pnpm.
  Per `AGENTS.md`, read the v56 docs (https://docs.expo.dev/versions/v56.0.0/)
  before writing native/SDK code — APIs changed.
- **Styling:** Tailwind v4 + NativeWind v5 via `react-native-css`. Use the CSS-wrapped
  components from `src/tw` (and `src/components/Screen.tsx` for SafeAreaView). Plain RN
  components do **not** accept `className` at runtime (`globalClassNamePolyfill: false`).
- **Checks (all must stay green):**
  - `pnpm test` — jest-expo (jest pinned to v29 to match the preset)
  - `npx tsc --noEmit`
  - `pnpm lint` (oxlint) / `pnpm format` (oxfmt)
  - `npx expo export --platform web` and `--platform ios` both bundle
- **Pre-commit hook** (`.githooks/pre-commit`, wired via `prepare` script): formats +
  lints staged files, skips `example/ docs/ .agents/ .claude/`. Auto-re-stages fmt fixes.
- **Puzzles:** regenerate with `pnpm generate:puzzles` (deterministic; writes to
  `assets/puzzles/`). Bump `PACK_VERSION` in `src/data/puzzleData.ts` to force re-import.

---

## Current state — Phases 1 & 3 DONE ✅  (Phase 2 was folded in)

A user can launch the app, start a new game by difficulty (or the daily puzzle),
play with cell-first or number-first input + notes, undo, erase, use hints, watch a
timer that auto-pauses on background, and complete a puzzle — fully offline. Board
highlighting and mistake/duplicate flagging respect the settings. **66 unit tests pass.**

### What exists
- **Domain** (`src/domain/sudoku/`): `types.ts`, `board.ts`, `notes.ts`, `validation.ts`
  (+ `index.ts` barrel). Pure, fully tested. **No `solver.ts`/`generator.ts` yet** — the
  generator is a build-time Node script only (`scripts/generate-puzzles.mjs`).
- **Data** (`src/data/`):
  - `db/client.ts` — single shared connection, WAL, runs migrations on open.
  - `db/schema.ts` + `db/migrations.ts` — `user_version`-based, all MVP tables created in
    migration v1 inside an exclusive transaction.
  - `puzzleData.ts` — bundles the 5 JSON packs (easy/medium/hard/expert/daily).
  - `repositories/puzzleRepository.ts` — import-once (`puzzle_packs` guard), random by
    difficulty, daily by index. Daily-pool rows use a `daily_` id prefix and are excluded
    from difficulty selection.
  - `repositories/gameRepository.ts` — `newGameState`, `createGame`, `saveGame`,
    `getGameById`, `getActiveGame`, `completeGame` (keeps the games row as `completed`).
  - `init.ts` — `initializeApp()`: open DB + migrate + import (idempotent).
- **Services** (`src/services/`): `dailyService.ts` — deterministic offline daily
  (`daysSinceEpoch % poolCount`), `getLocalDateKey`, tested.
- **State** (`src/state/useGameStore.ts`): zustand. Holds `game`, selection, `inputMode`
  ("cell"|"number"), `notesMode`, `justCompleted`. Actions: `loadGame`, `setGame`,
  `pressCell`, `pressNumber`, `erase`, `toggleNotesMode`, `setInputMode`. Mistakes
  increment whenever a placed value ≠ solution (visual flagging is a separate setting,
  not built yet). Persistence is fire-and-forget per action (no debounce yet).
- **UI**: `src/app/_layout.tsx` (init gate + SafeAreaProvider), `app/index.tsx` (Home:
  Continue/Daily/New Game), `app/game/[gameId].tsx` (Game screen + completion overlay).
  Components: `Board/SudokuBoard`, `Board/SudokuCell`, `NumberPad`, `GameControls`,
  `Screen`.

### Added in Phase 3
- **Settings**: `src/domain/settings.ts` (+ `DEFAULT_SETTINGS`, `normalizeSettings`),
  `settingsRepository` (single JSON blob in `settings` table), `useSettingsStore`
  (hydrated on boot). No Settings **screen** yet (Phase 6) — values are defaults until then.
- **Hints**: `domain/sudoku/hints.ts` (`computeCandidates`, `findHintCell`) + store
  `hint()` + Hint button. Reveals a correct cell, prefers naked singles, bumps `hintsUsed`.
- **Undo**: in-memory `undoStack` of `GameAction`s; `undo()` reverses the last move.
- **Timer**: committed `elapsedSeconds` + in-memory `lastStartedAt`; `useElapsedSeconds`
  ticks the display. Auto-pause on background via `AppState`; resume overlay on tap.
- **Haptics** (`src/services/haptics.ts`), gated by `hapticsEnabled`.
- **Debounced autosave** (600ms) with flush on pause/background/complete.
- **Settings-driven board**: peer/same-number highlight + mistake checking read settings;
  duplicates always flagged; givens never shown as errors. `autoNoteCleanup` honored.

### Known gaps (later phases)
- **Undo doesn't restore peer notes** that `autoNoteCleanup` removed (the `GameAction`
  type only stores the edited cell's notes — accepted limitation).
- **Daily** starts a normal game from the daily puzzle; **no `daily_progress` write,
  no streak** yet (Phase 4).
- **Completion overlay** shows time/mistakes/hints but **no share text, no ad hook** yet.
- **No Settings/Stats screens, no theme switching** yet (Phase 6 / Phase 4).

---

## Next phases (from the spec's build order)

### Phase 2 & 3 — DONE (see "Added in Phase 3" above)
`computeCandidates` in `hints.ts` covers the candidate logic a lightweight `solver.ts`
would have provided; no separate solver needed yet.

### Phase 4 — Retention (next up)
- `daily_progress` writes, daily **streak** logic (spec rules), completion screen with time
  + shareable result text, stats screen from `completed_games` (+ `statsService`,
  `statsRepository`).

### Phase 5 — Offline hooks (stubs)
- `analyticsService` (local `pending_events` queue; `flushPendingEvents` no-op),
  `adService` + `purchaseService` interfaces (no real SDKs), `entitlementRepository`
  cache. Never block gameplay; ads only post-completion.

### Phase 6 — Polish
- Settings screen + theme store, empty/error states, a11y labels, small-phone layout,
  broaden test coverage (streak logic, store reducers).

---

## Repos/tables not yet touched
`completed_games` (written but not read — Stats will read it), `daily_progress`,
`pending_events`, `entitlements`, `schema_meta`. Repositories for stats/events/
entitlements are specced in `mvp-handoff.md` but not yet created. (`settings` is now
read/written via `settingsRepository`.)

## Note: `knip` is wired up
`knip.json` + `pnpm knip` detect unused files/deps. Its `entry` is currently only
`scripts/**`, so it under-reports app usage and pruned several unused template deps
(expo-image, @expo/ui, expo-device/font/glass-effect/status-bar/symbols). If you add a
feature that needs one back, re-add it with `npx expo install <pkg>`.
