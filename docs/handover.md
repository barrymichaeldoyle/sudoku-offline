# Sudoku — Phase Handover

Living status doc for picking the work back up. Pairs with the full spec in
[`mvp-handoff.md`](./mvp-handoff.md) (scope, schema, acceptance criteria) and the
**Locked Decisions** section at the top of that file. Update this file as phases land.

_Last updated: 2026-06-19 — MVP feature-complete (Phase 6), plus the rewarded-hint flow
(with a 30s anti-spam cooldown) and "Remove Ads" purchase entry points (Settings, completion
screen, hint prompt). See `HINT_FLOW.md`. Branch: work directly on `main`._

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
play with cell-first or number-first input + notes, undo, erase, use hints, watch an
optional timer (with auto-pause on background when enabled), and complete a puzzle — fully
offline. Board highlighting and mistake/duplicate flagging respect the settings. **66 unit tests pass.**

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
  increment only when mistake checking is enabled (same gate for stats and board
  flagging). Persistence is fire-and-forget per action (no debounce yet).
- **UI**: `src/app/_layout.tsx` (init gate + SafeAreaProvider), `app/index.tsx` (Home:
  Continue/Daily/New Game), `app/game/[gameId].tsx` (Game screen + completion overlay).
  Components: `Board/SudokuBoard`, `Board/SudokuCell`, `NumberPad`, `GameControls`,
  `Screen`.

### Added in Phase 3
- **Settings**: `src/domain/settings.ts` (+ `DEFAULT_SETTINGS`, `normalizeSettings`),
  `settingsRepository` (single JSON blob in `settings` table), `useSettingsStore`
  (hydrated on boot). No Settings **screen** yet (Phase 6) — values are defaults until then.
- **Hints**: `domain/sudoku/hints.ts` (`computeCandidates`, `findHintCell`) + store
  `requestHint`/`confirmRewardedHint`/`dismissHintPrompt` + Hint button. Reveals a correct
  cell (prefers naked singles), bumps `hintsUsed`. Gated per the **Hint model** Locked
  Decision — see `HINT_FLOW.md` (rewarded-ad/premium/offline-free flow added after Phase 6).
- **Undo**: in-memory `undoStack` of `GameAction`s; `undo()` reverses the last move.
- **Timer**: committed `elapsedSeconds` + in-memory `lastStartedAt` when the timer
  setting is on; `useElapsedSeconds` ticks the display. Auto-pause on background via
  `AppState`; resume overlay on tap. When the timer is off, elapsed time is not tracked
  and pause/resume is disabled.
- **Haptics** (`src/services/haptics.ts`), gated by `hapticsEnabled`.
- **Debounced autosave** (600ms) with flush on pause/background/complete.
- **Settings-driven board**: peer/same-number highlight + mistake checking read settings;
  duplicates always flagged; givens never shown as errors. `autoNoteCleanup` honored.

### Added in Phase 4 (Retention)
- **Daily progress + streak**: `dailyRepository` (`startDailyProgress`,
  `getDailyProgress`, `getCompletedDailyDateKeys`, `completeDailyForGame`,
  `getDailyForGame`). Home calls `startDailyProgress` when a daily puzzle (carries
  `dateKey`) is started. `gameRepository.completeGame` now, inside its transaction, calls
  `completeDailyForGame` to stamp `daily_progress` complete and carry the `date_key` onto
  the `completed_games` row (NULL for ordinary games). Replays never clobber a recorded
  daily result (the update is gated on `completed_at IS NULL`).
- **Two daily tracks**: `domain/daily.ts` (`DailyTrack = "daily" | "challenge"`,
  `trackIdPrefix`). The normal **Daily Puzzle** drives the streak; the **Daily Challenge**
  is an optional extreme puzzle (no streak). `daily_progress` is keyed by
  `(date_key, track)` via **migration v2**. The generator emits a `challenge` pack
  (`extreme` difficulty, 22–27 clues, asymmetric dig); `getDailyPuzzle(track)` and the
  pool helpers select by track id-prefix. Streak reads only `track = 'daily'`. The new
  `extreme` difficulty is in `DIFFICULTIES` (stats) but not `NEW_GAME_DIFFICULTIES` (Home),
  so it's only reachable via the challenge. A future reward-ad story for both tracks is
  sketched in `docs/retention-monetization.md`.
- **Streak logic**: pure `domain/streak.ts` (`computeStreak`) — current run counts
  consecutive days ending today or yesterday; longest tracks the best historical run.
- **Stats**: `statsRepository.getCompletedGameStats` (aggregates from `completed_games`),
  `services/statsService.ts` (`getGameStats` = aggregates + streak; `getDailyCompletionInfo`
  for the completion screen). New `app/stats.tsx` screen + a Stats button on Home.
- **Completion screen**: shows daily streak when applicable and a **Share** button
  (RN `Share`) using pure `domain/shareText.ts` (`formatShareText`, tested).
- **Time util**: `domain/time.ts` `formatDuration` (re-exported from `useElapsedSeconds`).

### Added in Phase 5 (Offline hooks — stubs)
- **Analytics (local queue)**: `domain/analytics.ts` (event-name union),
  `eventRepository` over `pending_events` (capped at 1000, `getPendingEvents`/
  `markEventsSent` ready for a future sink), `services/analyticsService.ts`
  (`track` = fire-and-forget enqueue, never throws; `flushPendingEvents` no-op — no
  backend). Events wired: `app_opened` (boot), `puzzle_started`/`daily_started`
  (`gameLauncher`), `hint_used` + `puzzle_completed` (store), `daily_completed` +
  `share_result_tapped` (completion screen), `setting_changed` (settings store),
  `rewarded_hint_offered`/`rewarded_hint_watched` (hint flow), `premium_upgrade_tapped`
  (hint-prompt upsell).
- **Entitlements**: `domain/entitlements.ts` (`ENTITLEMENT_REMOVE_ADS`),
  `entitlementRepository` over `entitlements` (cache is the offline source of truth),
  `useEntitlementStore` (hydrated on boot, `hasRemoveAds()` non-reactive read).
- **Purchase stub**: `services/purchaseService.ts` (`PurchaseService` shape;
  `purchaseRemoveAds` returns false, refresh/restore no-op — no store SDK in MVP).
  `useEntitlementStore.purchaseRemoveAds()`/`restorePurchases()` wrap it (re-read the cache on
  success). The reusable `components/RemoveAdsButton.tsx` (hides itself when premium) surfaces
  the purchase on the Settings "Ads & Purchases" section (+ Restore Purchases) and the
  completion screen; the hint prompt has its own upgrade button that also reveals the hint.
- **Ad stub**: `services/adService.ts` — **no forced ads** (no interstitials/banners;
  the post-completion interstitial was dropped 2026-06-19 as too intrusive). Only
  user-initiated rewarded ads: `isRewardedHintAvailable`/`showRewardedHintAd` (return false,
  no SDK). Premium ("Remove Ads") will skip rewarded prompts and grant perks free.
- **Shared launcher**: `services/gameLauncher.ts` `launchPuzzle()` centralizes
  create-game + daily-progress + start analytics; used by Home and the completion screen's
  new **New Game** action (replays the same difficulty for ordinary games).

### Added in Phase 6 (Polish)
- **Theme switching**: `services/theme.ts` `applyThemePreference` →
  `Appearance.setColorScheme` ("system" → "unspecified"; `react-native-css` tracks
  `Appearance`, driving `dark:` variants). Applied on boot (after settings hydrate) and on
  the `theme` setting change. (No separate theme store — `Settings.theme` is the source.)
- **Settings screen** (`app/settings.tsx`): theme segmented control, toggles for all six
  gameplay settings (RN `Switch`), and **Reset Stats** (confirmed `Alert`) →
  `statsRepository.resetStats` clears `completed_games` + `daily_progress`. Settings button
  on Home.
- **a11y**: `accessibilityRole`/`Label`/`State` on board cells, number pad, controls, and
  all screen buttons.
- **Stats empty state** when no completed games. (Board was already responsive via
  `aspect-square w-full`, so small-phone layout needed no change.)
- **Tests**: `services/theme.test.ts` + `state/useGameStore.test.ts` (reducer coverage:
  place/clear/mistake/notes/erase+undo, with haptics/analytics/gameRepository mocked).
  **91 tests pass.**

### Known gaps (later phases / post-MVP)
- **Undo doesn't restore peer notes** that `autoNoteCleanup` removed (the `GameAction`
  type only stores the edited cell's notes — accepted limitation).
- **Analytics/ads/purchases are stubs**: no real SDKs, no event sink. `flushPendingEvents`,
  `purchaseRemoveAds`, and the rewarded-ad bodies are integration points only.
- **`inputMode` lives in the game store** (per-session, toggled in GameControls), not in
  `Settings` — so it isn't on the Settings screen. Move to `Settings` if persistence is wanted.
- **Push notifications are planned only**: see `docs/push-notifications.md` for the
  opt-in daily puzzle reminder plan based on local `expo-notifications` scheduling.

---

## Next phases (from the spec's build order)

### Phase 2 & 3 — DONE (see "Added in Phase 3" above)
`computeCandidates` in `hints.ts` covers the candidate logic a lightweight `solver.ts`
would have provided; no separate solver needed yet.

### Phase 4 — Retention — DONE ✅ (see "Added in Phase 4" above)

### Phase 5 — Offline hooks (stubs) — DONE ✅ (see "Added in Phase 5" above)

### Phase 6 — Polish — DONE ✅ (see "Added in Phase 6" above)

**All six build-order phases are complete.** The MVP is feature-complete per
`mvp-handoff.md`'s Definition of Done: installable, fully playable offline, daily +
challenge, stats/streaks, settings + theme, and clean service boundaries for the
(stubbed) ads/purchases/analytics.

---

## Repos/tables not yet touched
Only `schema_meta` remains unused. `pending_events` (eventRepository) and `entitlements`
(entitlementRepository) are now read/written, as are `completed_games`, `daily_progress`,
and `settings`.

## Note: `knip` is wired up
`knip.json` + `pnpm knip` detect unused files/deps. Its `entry` is currently only
`scripts/**`, so it under-reports app usage and pruned several unused template deps
(expo-image, @expo/ui, expo-device/font/glass-effect/status-bar/symbols). If you add a
feature that needs one back, re-add it with `npx expo install <pkg>`.
