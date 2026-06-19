# Retention Monetization — Streak Restore & Challenge Archive (planned)

> Reward-ad mechanics targeting completionist users. **Not yet built** — all of
> this depends on the Phase 5 `adService` (rewarded ads) + `entitlementRepository`.
> Documented now so the daily/challenge schema is designed to support it without
> rework. Core principle: **no intrusive ads during play** — no interstitials,
> and nothing during or between puzzles that blocks the board. Non-intrusive
> **native ads are fine on non-gameplay surfaces** (e.g. the completion/success
> screen), and **rewarded ads** are opt-in unlocks the player chooses for a clear
> benefit; neither ever blocks offline play. Restore/unlock state is written
> locally once a reward fires. Premium ("Remove Ads") removes the native ads and
> grants the rewarded perks free/instant.

Pairs with [`mvp-handoff.md`](./mvp-handoff.md) (scope/schema) and
[`handover.md`](./handover.md) (phase status). Targets **Phase 5+ / post-ads**.

---

## Prerequisite already in place

The two-track daily work keys `daily_progress` by `(date_key, track)` where
`track ∈ {'daily','challenge'}`. That is the foundation both features below build
on: streak restore writes a `track='daily'` row, and the challenge archive reads
`track='challenge'` rows. No rework of that schema is needed.

The daily/challenge selection is deterministic per calendar date
(`daysSinceEpoch % poolCount`), so **every past date already has a computable
puzzle offline** — the archive feature gates access, it does not need stored
content.

---

## 1. Streak Restore via rewarded ad

**Goal:** when a user misses a day and their daily streak would reset, let them
watch a rewarded ad to repair the gap and keep the streak alive.

**Why it's a clean fit:** `computeStreak(completedDateKeys, todayKey)` is pure and
set-based — it bridges any consecutive run it is given. A restore is just
*crediting a missed `date_key`* into the set it consumes. The streak algorithm
itself does not change.

**Data model:** add a provenance column to `daily_progress` so genuine plays are
distinguishable from ad credits (future migration, see §5):

- `credit_source TEXT NOT NULL DEFAULT 'played'` — `'played'` | `'ad_restore'`.
- A restored day gets a `daily_progress` row (`track='daily'`) with `completed_at`
  = restore timestamp, `game_id` NULL, `credit_source='ad_restore'`.
- `getCompletedDailyDateKeys()` keeps returning all completed keys (the streak
  counts restores). Stats wanting *true* completions filter `credit_source='played'`.

**Service surface** (extends the Phase 5 `AdService`):

```ts
restoreStreakViaAd(missedDateKey: string): Promise<boolean>; // watch ad -> on reward, write the row
getRestorableGap(todayKey: string): Promise<string[] | null>; // eligible day(s), or null
```

**Rules / anti-abuse (tunables to document at build time):**

- Only offer when a *real* streak (≥ N days of `'played'`) was just broken — a
  streak cannot be fabricated from nothing.
- Only bridge a small window (e.g. the single most recent missed day; gaps ≤ 1–2 days).
- Cap frequency (e.g. 1 restore per 7 days). Track via a `schema_meta` key or by
  counting `ad_restore` rows.
- The restore write is local; only the ad impression touches the network.

---

## 2. Challenge Archive — unlock past dailies via rewarded ad

**Goal:** the Daily Challenge (extreme track) is deterministic per date, so every
past date already has a puzzle. Gate un-opened past challenges behind a rewarded
ad to monetize completionists who want to catch up.

**Availability logic for a past challenge date:**

- **Available** if a `daily_progress` row exists for `(date_key, track='challenge')`
  — i.e. it was already opened/played — OR an unlock record exists.
- **Locked** otherwise → rewarded ad to unlock → then start the game normally.
- Today's challenge is always free.

**Data model:** a dedicated table reads cleanly for an archive list (future
migration, see §5):

```sql
CREATE TABLE challenge_unlocks (
  date_key TEXT PRIMARY KEY NOT NULL,
  unlocked_at TEXT NOT NULL,
  source TEXT NOT NULL   -- 'ad_reward' | 'entitlement'
);
```

(Alternative: reuse `entitlements` with key `challenge_unlock:<date_key>`, but a
dedicated table is better for listing the archive.)

**Service surface:**

```ts
isChallengeUnlocked(dateKey: string): Promise<boolean>;
unlockChallengeViaAd(dateKey: string): Promise<boolean>;
```

**UI (Phase 6-ish):** a Challenge Archive screen — a scrollable list of past
challenge dates with played / unlocked / locked🔒 states; tapping a locked one
prompts the rewarded-ad flow.

---

## 3. Cross-cutting decisions to settle later

- **Remove Ads entitlement:** does owning `remove_ads` make restores/archive
  unlocks free and instant (no ad), or keep the flow with the ad skipped?
  *Recommended:* premium users get them free/instant — and premium also removes
  the native ads (e.g. on the success screen), so "Remove Ads" is a clean,
  ad-free experience.
- **Offline behavior:** if no ad is available (offline), surface a graceful "try
  again later" — never hard-block. The restore/unlock are local writes once the
  reward fires.

---

## 4. New analytics events (local queue)

`streak_restore_offered`, `streak_restore_completed`, `challenge_unlock_offered`,
`challenge_unlock_completed`, `rewarded_ad_watched`.

---

## 5. Migration impact

Both schema additions are **future migrations (v3+)**, layered on top of the v2
`(date_key, track)` change:

- `credit_source` column on `daily_progress` (streak restore).
- `challenge_unlocks` table (challenge archive).

Optional optimization: `credit_source` *could* be folded into the v2
`daily_progress` rebuild now (default `'played'`) to save a future migration. If
not, it is a clean additive v3 column later — no data backfill needed since the
default covers all existing rows.
