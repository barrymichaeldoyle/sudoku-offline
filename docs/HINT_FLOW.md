# Hint Flow

How the **Hint** control behaves. Pairs with
[`DESIGN_GUIDELINES.md`](./DESIGN_GUIDELINES.md) §10.2 / §19 and
[`retention-monetization.md`](./retention-monetization.md).

There is **no free-hint allowance**. The model is:

- **Premium** (`remove_ads`) — unlimited hints, revealed instantly, no prompt,
  no ads.
- **Free user, online** (a rewarded ad is loaded) — watch the rewarded ad to
  reveal the hint. The prompt is also the app's premium upsell surface.
- **Free user, offline** (no ad loaded) — reveal the hint **for free**, the
  premium experience. This keeps the offline-first promise that hints always
  work without a connection, and an ad is never shown when one can't load.

Consistent with the rest of the app: **no forced ads** (the rewarded ad is
opt-in, for a clear benefit), and ads never appear on the board itself.

## What a hint reveals

One correct value from the solution — preferring a "naked single" (a cell with
exactly one valid candidate), otherwise the first empty non-given cell. The
value is always correct even if the player placed wrong values elsewhere. Logic
is in [`domain/sudoku/hints.ts`](../src/domain/sudoku/hints.ts); the flow is
orchestrated in [`state/useGameStore.ts`](../src/state/useGameStore.ts)
(`requestHint` / `confirmRewardedHint` / `dismissHintPrompt`).

## Pressing Hint (`requestHint`)

0. **Cooldown active** — a reveal happened within the last `HINT_COOLDOWN_MS`
   (30s). No-op; the Hint button is disabled (see Cooldown below).
1. **Nothing to reveal** — no empty non-given cell left. No-op; no prompt.
2. **Premium** (`remove_ads`) — reveal immediately, `hintsUsed += 1`.
3. **No ad loaded** (`adService.isRewardedHintAvailable()` → false, i.e.
   offline) — reveal immediately for free. Hints always work offline.
4. **Ad loaded** — open the rewarded-hint prompt (`hintPromptVisible = true`).
   Nothing is revealed yet and `hintsUsed` is unchanged.

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
> Watch a short ad to reveal one hint.

**Watch Ad** → `confirmRewardedHint` → `adService.showRewardedHintAd()`. On
reward, reveal one hint. If the reward does not fire, the prompt stays so the
player can retry or dismiss.

The prompt also carries the **Remove ads · Unlimited hints** upsell button
(`purchaseRemoveAds`). On a successful purchase the prompt closes and the
requested hint is revealed immediately (the player is now premium). **Not now**
dismisses without revealing.

## MVP note

There is no ad SDK or store SDK in MVP, so `adService.isRewardedHintAvailable()`
returns `false` (treated as "offline") and `purchaseService.purchaseRemoveAds()`
returns `false`. In practice every player currently gets the free-offline path —
hints just reveal — and the rewarded prompt is never reached. This is
intentional: the flow is wired correctly for when the rewarded-ad and
in-app-purchase SDKs land in Phase 5; no gameplay rework is needed then.

## Analytics

- `hint_used` — every actual reveal (premium or rewarded), with `difficulty`.
- `rewarded_hint_offered` — the prompt opened (non-premium press).
- `rewarded_hint_watched` — the rewarded ad granted and a hint was revealed.
- `premium_upgrade_tapped` — the upsell button tapped (`source: "hint_prompt"`).
