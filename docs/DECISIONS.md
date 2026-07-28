# Offline Sudoku: Decision Log

Decisions that are easy to lose when looking only at the implementation. New
entries should explain the trade-off, not repeat the code.

## 2026-07-28: Hint explanations preserve board context and solve time

**Decision:** After a hint reveal, a compact teaching card appears above the
board. The revealed cell and highlighted peers remain fully visible, while
board input is temporarily inactive. Solve time is suspended from the first
hint prompt through any rewarded ad and the explanation, then resumes when the
player dismisses the hint surface.

**Why:** Candidate guidance is easier to understand when the player can inspect
the affected row, column, and box. Reading an explanation or watching an
optional ad is not solving time and should not make personal bests less fair.

## 2026-07-28: Store screenshots come from a Release simulator build

**Decision:** The automated screenshot command compiles a Release simulator
app with the hidden screenshot routes enabled at bundle time. It installs that
same build on the required iPhone and iPad simulators, then captures deterministic
deep-linked states without Metro.

**Why:** Development builds can show Expo development-client UI during launch
or reconnection, which can silently contaminate every store image. A Release
bundle is slower to compile but produces customer-facing UI and makes the
capture independent of local Metro state.

## 2026-07-28: Hints teach from the current board without running a solver

**Decision:** A hint still reveals one correct value, then presents a short
explanation based on candidates calculated from the board as it currently
stands.

- Prefer a genuine naked single: exactly one candidate, and that candidate
  matches the solution.
- Otherwise choose the unresolved cell with the fewest candidates that still
  includes its solution value and state the remaining candidate set honestly.
- If a wrong nearby entry excludes the solution value, say that the row,
  column, or box contains a conflict. Do not claim a logical deduction that the
  current board does not support.
- Select the revealed cell and temporarily show its peers, even when normal peer
  highlighting is disabled, so the explanation has visible context.

**Why:** This adds useful teaching value with a small, deterministic,
unit-testable layer. A full human-style Sudoku solver and strategy engine would
be substantially larger and should be a separate roadmap item if users want
step-by-step coaching.

## 2026-07-28: Recent Games uses filtered, capped local queries

**Decision:** Stats initially loads 10 recent results. The player can filter by
All, Daily, or difficulty and load 10 more at a time, capped at 100 visible
rows. Filters query SQLite rather than filtering a large in-memory result.

Recent rows may reopen the retained solved board when the related game still
exists. Older imported/seeded summaries without a retained game remain
read-only and are labelled “summary only.” Reset Stats continues to remove
completed history.

**Why:** Existing `completed_games` data already supports the feature without a
migration. Query-backed filtering gives predictable memory and render cost,
while the cap prevents Stats becoming an unbounded archive screen.

## 2026-07-28: Fixed game geometry is the Dynamic Type exception

**Decision:** System font scaling remains enabled for screens, settings, Stats,
help, and modal explanations. The 9×9 board digits/notes and 9-key number pad do
not scale independently because they must fit fixed square geometry. Compact
game-control labels may shrink to one line rather than overlap.

The app also:

- supplies spoken labels and state for board cells and interactive controls;
- uses scrollable, width-capped overlays so large text and iPad layouts remain
  usable;
- suppresses confetti when Reduce Motion is enabled;
- avoids using colour alone for important state.

**Why:** Unbounded glyph scaling inside cells can clip numbers or move hit
targets, making the core puzzle less usable. The exception is deliberately
limited to fixed game geometry; explanatory and navigational text should still
honour the user’s preferred size.

## 2026-07-28: Rating prompt testing cannot alter production eligibility

**Decision:** Production requests use the native `expo-store-review` action
after at least three completions across two sessions, with the app cooldown and
sensitive-flow suppression. There is no custom star selector or pre-prompt.

A Settings developer tool can call the native request directly in development
builds. It does not update the saved last-attempt date, counters, or session
guard, and the operating system may still suppress the sheet.

**Why:** The diagnostic proves that the native module is linked without
weakening respectful production timing or contaminating locally persisted
eligibility state.

## 2026-07-28: Security advisories use exact temporary transitive overrides

**Decision:** `pnpm-workspace.yaml` pins the exact vulnerable transitive
versions reported by `pnpm audit` to their first patched versions:

- `brace-expansion` 1.1.15 → 1.1.16 and 5.0.6 → 5.0.8
- `js-yaml` 4.2.0 → 4.3.0
- `postcss` 8.5.15 → 8.5.18
- `shell-quote` 1.8.4 → 1.8.5

The existing Jest coverage-only `js-yaml` override is also pinned to 4.3.0.

**Why:** These are patch-level fixes inside the Expo/React Native/Jest build
toolchain. Exact overrides close the known issues without broad direct
dependency upgrades that could move the project outside Expo SDK 57’s supported
React and React Native versions.

**Removal policy:** On dependency upgrades, run `pnpm audit` and `pnpm why` for
each package. Remove an override once no parent requests the vulnerable version,
then reinstall and run the full CI check.

## 2026-07-28: Keep the next ASO update focused and measurable

**Decision:** Keep the current App Store name and subtitle for the first release
after 1.1.3. Update the keyword field, promotional text, description, release
notes, and screenshots to reflect explanatory hints and Recent Games.

The keyword field uses all 100 bytes without exact title or subtitle duplicates.
The screenshot sequence keeps the established offline and no-ads promises first,
then shows the two new features before streaks and dark mode.

**Why:** The new features provide credible conversion material, but changing the
title, subtitle, icon, copy, and opening visual together would make results hard
to interpret. Product Page Optimization remains a later, single-variable test
after a useful traffic baseline exists.

**Copy rule:** Customer-facing store metadata should use direct punctuation and
must not use em dashes. `pnpm metadata:check` enforces this alongside Apple field
limits and keyword allocation.
