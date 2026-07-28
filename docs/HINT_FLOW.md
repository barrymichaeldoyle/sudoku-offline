# Hint Flow

How the **Hint** control behaves. Pairs with
[`DESIGN_GUIDELINES.md`](./DESIGN_GUIDELINES.md) §10.2 / §19 and
[`retention-monetization.md`](./retention-monetization.md).

There is **no free-hint allowance**. The model is:

- **Premium** (`remove_ads`): unlimited hints and no ads. A confirmation
  prevents accidental reveals unless the player enables **Instant hints**.
- **Free user, online** (a rewarded ad is loaded) — watch the rewarded ad to
  reveal and explain the hint. The prompt is also the app's premium upsell
  surface.
- **Free user, offline** (no ad loaded) — reveal the hint **for free**, the
  same premium experience, after confirmation. This keeps the offline-first promise
  that hints always work without a connection, and an ad is never shown when
  one can't load.

Consistent with the rest of the app: **no forced ads** (the rewarded ad is
opt-in, for a clear benefit), and ads never appear on the board itself.

## What a hint reveals and explains

One correct value from the solution, followed by a teaching card:

1. Prefer a genuine naked single whose only candidate is the solution value.
2. Otherwise choose the unresolved cell with the fewest currently valid
   candidates that still includes its solution value, and list those candidates.
3. If a wrong nearby entry has excluded the solution value, reveal the correct
   value but explicitly tell the player to check the highlighted row, column,
   or box for a conflict.

The selected cell and its peers remain highlighted on a fully visible board.
The compact teaching card sits above the board instead of covering it, and the
board and input controls stay inactive until the player dismisses the card.
The explanation never claims that a value was logically forced when multiple
candidates remain. This is intentionally a lightweight candidate layer, not a
full human-strategy solver; see [`DECISIONS.md`](./DECISIONS.md).

Solve time is suspended while the confirmation, rewarded ad, or teaching card
has focus. Dismissing the prompt or explanation resumes timing only when the
timer is enabled and the game is still active.

Logic is in [`domain/sudoku/hints.ts`](../src/domain/sudoku/hints.ts); the flow
is orchestrated in
[`state/useGameStore.ts`](../src/state/useGameStore.ts) (`requestHint`,
`confirmHint`, `confirmRewardedHint`, and the two dismiss actions).

## Pressing Hint (`requestHint`)

0. **Cooldown active** — a reveal happened within the last `HINT_COOLDOWN_MS`
   (30s). No-op; the Hint button is disabled (see Cooldown below).
1. **Nothing to reveal** — no empty non-given cell left. No-op; no prompt.
2. **Premium with Instant hints enabled:** reveal immediately.
3. **Premium with Instant hints disabled:** open a simple confirmation.
4. **No ad loaded** (`adService.isRewardedHintAvailable()` → false, including
   offline): open the same simple confirmation; the reveal remains free.
5. **Ad loaded:** open the rewarded-hint prompt
   (`hintPromptVisible = true`, `hintPromptMode = "rewarded"`).

Nothing is counted until a value is actually revealed. Every successful reveal
sets `hintsUsed += 1` and opens the post-reveal explanation.

`hintsUsed` (persisted on the game, shown on the completion screen) counts every
revealed hint — premium, free-offline, or rewarded.

## Cooldown

Every reveal sets `hintCooldownUntil = now + HINT_COOLDOWN_MS` (30s). While it is
in the future, `requestHint` is a no-op and the Hint button shows a countdown
(`Hint 12s`) and is disabled (`useHintCooldownRemaining`). This stops players
from spamming hints, which would trivialize the puzzle — so it applies to
**everyone, premium included**. The cooldown is per-session (in memory) and
clears on game load/reset.

## Rewarded prompt

`HintPromptOverlay` in [`app/game/[gameId].tsx`](../src/app/game/[gameId].tsx).
Calm, dismissible, no dark patterns. Because the store only opens it when an ad
is actually loaded, the overlay always offers the ad — there is no offline
branch in the UI (offline players never reach it; they get a free hint).

> Need a hint?
> Watch a short ad to reveal one hint and see why it fits.

**Watch Ad** → `confirmRewardedHint` → `adService.showRewardedHintAd()`. On
reward, reveal and explain one hint. If the reward does not fire, the prompt
stays so the player can retry or dismiss.

The prompt also carries the **Remove ads · Unlimited hints** upsell button
(`purchaseRemoveAds`). On a successful purchase the prompt closes and the
requested hint is revealed immediately (the player is now premium). **Not now**
dismisses without revealing.

## Current integration

The native app uses `react-native-google-mobile-ads` for rewarded hints and
`expo-iap` for the `remove_ads` purchase. iOS has production ad units. Android
continues to use Google test units until the Play release is configured. If no
rewarded ad is available, including while offline, the free-offline branch still
offers the free confirmation and reveal.

## Analytics

- `hint_used`: every actual reveal, with `difficulty` and explanation
  `strategy`.
- `rewarded_hint_offered` — the prompt opened (non-premium press).
- `rewarded_hint_watched` — the rewarded ad granted and a hint was revealed.
- `premium_upgrade_tapped` — the upsell button tapped (`source: "hint_prompt"`).
