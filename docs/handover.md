# Sudoku — Phase Handover

Living status doc for picking the work back up. Pairs with the full spec in
[`mvp-handoff.md`](./mvp-handoff.md) (scope, schema, acceptance criteria) and the
**Locked Decisions** section at the top of that file. Update this file as phases land.

_Last updated: end of Phase 1 (2026-06-18). Branch: work directly on `main`._

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

## Current state — Phase 1 DONE ✅

A user can launch the app, start a new game by difficulty (or the daily puzzle),
play with cell-first or number-first input + notes, and complete a puzzle — fully
offline. 57 unit tests pass.

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

### Known gaps / shortcuts taken in Phase 1 (revisit in later phases)
- **No timer** — `elapsedSeconds` stays 0; header shows mistakes only.
- **No undo, no hints** — `GameAction` type exists but no undo stack; `hintsUsed` always 0.
- **No haptics**, no auto-pause on background.
- **Save is immediate per action**, not debounced (spec wants debounce — Phase 3).
- **Mistake-checking / highlight toggles** not wired to settings (board always shows
  conflicts + peer/same-number highlight). Settings table exists but unused.
- **Daily** starts a normal game from the daily puzzle; **no `daily_progress` write,
  no streak** yet (Phase 4).
- **Completion overlay** is minimal (no time/share, no interstitial hook).

---

## Next phases (from the spec's build order)

### Phase 2 — Core Sudoku polish / remaining input
Mostly done. Remaining: confirm both input modes feel right; consider a lightweight
`solver.ts` (candidate computation) now since hints (Phase 3) and smarter generation
will want it.

### Phase 3 — Game UX (the next big chunk)
- **Timer**: store `elapsedSeconds` + in-memory `lastStartedAt`; `display = saved + now -
  lastStartedAt`. Auto-pause on background (AppState), resume on user tap. Persist on
  pause/background.
- **Undo**: push `GameAction`s (already typed) onto a stack in the store; `undo()` reverses
  the last value/note/erase.
- **Haptics** (`expo-haptics`, already installed): place / invalid / complete / toggle —
  gated by the `hapticsEnabled` setting.
- **Debounced autosave**: replace per-action `saveGame` with debounce + flush on
  pause/background/complete.
- **Settings-driven highlighting / mistake checking**: read toggles instead of always-on.
- **Hints** (`hintService` + `domain/sudoku/hints.ts`): reveal a safe correct cell, prefer
  single-candidate; increment `hintsUsed`. Keep offline-only; leave a seam for the
  rewarded-ad path.

### Phase 4 — Retention
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
`settings`, `completed_games` (written but not read), `daily_progress`, `pending_events`,
`entitlements`, `schema_meta`. Repositories for settings/stats/events/entitlements are
specced in `mvp-handoff.md` but not yet created.
