# Offline Sudoku — Current Handover

Living implementation and release-status summary. Last updated: 2026-07-28.

Historical MVP decisions remain in [`mvp-handoff.md`](./mvp-handoff.md), but
this file is the source of truth for what exists now. Product and growth work is
prioritized in [`ROADMAP.md`](./ROADMAP.md).

## Release state

- Product name: **Offline Sudoku**.
- Installed home-screen name: **Sudoku**.
- Version: `1.1.3`.
- iOS: available on the App Store.
- Apple app ID: `6782209083`.
- Release mode: manual after approval (`automaticRelease: false`).
- Android: configured at the Expo app level but not prepared for Play release.
- No backend or account system. Core play and persistence are offline-first.

See [`APP_STORE_LAUNCH.md`](./APP_STORE_LAUNCH.md) for the operational release
checklist.

## How to work in this repo

- Read the exact Expo SDK 57 documentation before changing native or Expo APIs:
  https://docs.expo.dev/versions/v57.0.0/.
- Use pnpm. The stack is Expo SDK 57, Expo Router, React 19.2, React Native
  0.86, TypeScript, Zustand, SQLite, Tailwind 4, NativeWind 5, and
  `react-native-css`.
- Use wrapped components from `src/tw`; plain React Native components do not
  receive `className` at runtime.
- Keep native configuration in `app.json` and config plugins. The generated
  `ios/` and `android/` projects are not sources of truth.
- Verify app behavior on the iOS simulator only unless `AGENTS.md` is explicitly
  changed for an Android-release task. Do not use the web target for app
  verification: the database migrations use `withExclusiveTransactionAsync`,
  which Expo SQLite does not support on web.
- Run `pnpm ci:check` for the complete static/unit test suite. Run native UI and
  integration checks with `pnpm ios` or `expo run:ios`.
- Commit or push only when asked.

## Current product

Players can:

- start Easy, Medium, Hard, or Expert puzzles;
- play a deterministic Daily Puzzle and extreme Daily Challenge offline;
- resume an active game with debounced SQLite autosave;
- use cell-first or number-first input, pencil notes, undo, erase, and hints;
- receive candidate-based explanations after hints, including honest conflict
  guidance when a wrong nearby entry affects the board;
- configure mistake checking, highlighting, note cleanup, timer, haptics, and
  light/dark/system appearance;
- view aggregate stats, best times, mistake-free totals, daily streaks, and
  recent completed games filtered by Daily or difficulty, loading up to 100;
- reopen the retained solved board for a recent result;
- open in-app play guidance, support, privacy, and version information;
- share an exact puzzle or daily challenge through universal links with a time
  or mistake target to beat;
- opt into a locally scheduled daily reminder;
- purchase or restore the one-time `remove_ads` entitlement.

There are no interstitials and no ads on the board. Free users may see passive
native ads on completion and Stats. Rewarded ads are user-initiated for hints.
Hints remain available offline when an ad cannot load.

## Implemented systems

### Data and game domain

- SQLite opens through one shared client with WAL enabled.
- Ordered `PRAGMA user_version` migrations run inside exclusive transactions.
- Schema version 5 is current. Never edit a shipped migration; add the next
  numbered migration.
- Bundled packs cover easy, medium, hard, expert, daily, and challenge puzzles.
- Completed game rows are retained and drive the capped Recent Games section in
  Stats without an additional migration. It loads 10 at a time, filters in
  SQLite, and caps the visible list at 100.
- Daily progress is keyed by `(date_key, track)` where track is `daily` or
  `challenge`.

### Monetization

- `react-native-google-mobile-ads` is integrated.
- iOS uses production app/ad unit IDs and requests non-personalized ads.
- Android deliberately uses Google test IDs until its AdMob app and placements
  are created.
- `expo-iap` backs the non-consumable
  `com.barrymichaeldoyle.sudokuoffline.remove_ads` product.
- `IAP_ENABLED` is `true`; purchase and restore surfaces are visible to eligible
  users.
- The entitlement cache is the offline source of truth and is refreshed
  best-effort from the store.
- `expo-store-review` requests the native rating sheet after at least three
  completions across two sessions, with a 180-day app cooldown and suppression
  around rewarded-ad and purchase flows. The OS may still suppress a request.
- Development Settings includes a native review smoke test. It bypasses
  eligibility without changing production counters or cooldown state.

### Accessibility

- Board cells and controls expose spoken labels and important state.
- Dynamic Type remains enabled outside fixed board/keypad geometry; game
  overlays are width-capped and scrollable for large text and iPad.
- Reduce Motion suppresses confetti and the existing board/control animations
  use reduced-motion-aware helpers.

### Dependency security

- Exact patch-level transitive overrides in `pnpm-workspace.yaml` remediate the
  current Expo/Jest toolchain advisories without upgrading beyond the Expo SDK
  57 compatibility set.
- Run `pnpm audit` after dependency changes and follow the removal policy in
  [`DECISIONS.md`](./DECISIONS.md) rather than leaving obsolete overrides.

### Notifications

- `expo-notifications` local scheduling is implemented.
- Reminders are opt-in and request OS permission only after user intent.
- The app opportunistically schedules the next relevant reminder and suppresses
  reminders after the current daily is complete.
- Notification taps route to today's Daily Puzzle.

See [`push-notifications.md`](./push-notifications.md) for behavior and test
details.

### Analytics

- Product events are written to the local `pending_events` queue.
- There is no remote product-event sink; `flushPendingEvents` remains a no-op.
- EAS Insights supplies privacy-conscious baseline usage/version adoption data.
- App Store Connect is the source for acquisition and conversion metrics.

### Store and sharing

- EAS Metadata reads localized Apple listing data from `store/locales/*.json`
  through `store.config.js`.
- Only `en-US` exists today.
- Store screenshots are generated from deterministic seeded app states. See
  [`APP_STORE_LAUNCH.md`](./APP_STORE_LAUNCH.md#generating-store-screenshots).
- The next release metadata highlights explanatory hints and Recent Games. Its
  six-shot iPhone and iPad sets were captured from a Release simulator build,
  visually reviewed, and encoded without alpha channels.
- `pnpm metadata:check` enforces Apple copy limits, a 100-byte keyword field, and
  the store copy punctuation rule.
- Universal links use `sudokuoffline.expo.app`; installed users open the exact
  puzzle and other users see a store landing page.

## Known gaps

- Product events are not available for funnel or retention analysis beyond the
  device-local queue.
- There is no achievement system.
- The app and store listing have no non-English localization.
- Android production ads, Play Billing, listing, compliance forms, submission
  profile, and platform QA are incomplete.
- Planned streak restore and challenge archive are not built; see
  [`retention-monetization.md`](./retention-monetization.md).

## Stable product constraints

- Core Sudoku must remain fully playable without network access.
- Never block app launch, game creation, saving, completion, stats, or basic
  hints on network work.
- Do not add forced ads, interstitials, or ads on the game board.
- Avoid accounts, subscriptions, remote puzzle fetching, and backend complexity
  until measured demand justifies them.
- Preserve existing SQLite data across upgrades.
