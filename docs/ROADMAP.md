# Offline Sudoku — Bang-for-Buck Roadmap

Last reviewed: 2026-06-27.

This is the assignment-ready backlog for growing the app primarily through
store discovery, product quality, retention, ratings, and sharing rather than
paid marketing. Current implementation status lives in
[`handover.md`](./handover.md); iOS release operations live in
[`APP_STORE_LAUNCH.md`](./APP_STORE_LAUNCH.md).

## Operating rules

- Version 1.0.0 is Waiting for App Review. Do not replace or withdraw the binary
  for roadmap work unless Apple identifies a release blocker.
- Binary changes belong to 1.0.1 or later.
- Establish a post-launch baseline before interpreting an ASO or product change.
- Assign one task ID per agent. An agent may split its task into commits, but it
  must not absorb neighboring roadmap items without approval.
- Every implementation task must update relevant docs and add automated tests
  for pure logic.
- Verify app changes on the iOS simulator under the current `AGENTS.md` policy.
  Android release tasks are blocked from shipping until that policy explicitly
  permits Android verification.
- Preserve offline-first behavior, local data, the no-interstitial rule, and the
  absence of ads on the game board.

## Priority summary

| Rank | Initiative | Expected leverage | Effort | Start |
| ---: | ---------- | ----------------- | ------ | ----- |
| 1 | Rating prompt | High organic conversion/trust | Small | 1.0.1 |
| 2 | Launch baseline and ASO iteration | High; prevents blind decisions | Small | At launch |
| 3 | Android release | High addressable reach | Medium | Start prep now |
| 4 | Brand/share-loop polish | Medium-high organic acquisition | Small | Now/1.0.1 |
| 5 | First localized release | Medium-high global reach | Medium | After baseline |
| 6 | Recent game history | Medium retention value | Small-medium | After 1.0.1 |
| 7 | Achievements | Unproven retention value | Medium | Validate later |
| 8 | Streak restore/archive | Unproven; adds monetization complexity | Medium-large | Defer |

## Immediate release and measurement work

### BF-001 — Launch and baseline dashboard

**Priority:** P0  
**Effort:** Small, operational  
**Dependency:** App approval and manual release

**Goal:** capture a trustworthy baseline before changing acquisition surfaces.

**Scope:**

- Manually release 1.0.0 after approval.
- Confirm the public App Store URL, install, universal links, IAP, rewarded ads,
  reminders, and offline launch.
- Record weekly App Store Connect impressions, product-page views, conversion,
  first-time downloads, crashes, ratings, proceeds, and territory mix.
- Record EAS Insights active-user and version-adoption data.
- Add a dated baseline section or linked report without committing credentials or
  private exports.

**Acceptance criteria:**

- The README says Available and uses the exact App Store URL.
- A repeatable weekly metric template exists.
- At least seven days of baseline data are recorded before the first listing
  experiment is evaluated, unless a clear listing defect needs immediate repair.

### BF-002 — Product-name and public-link consistency

**Priority:** P0  
**Effort:** Small  
**Dependency:** None for docs/web; app string changes target 1.0.1

**Goal:** make **Offline Sudoku** the only public product name.

**Scope:**

- Audit app UI strings, universal-link landing pages, share copy, generated
  screenshots, GitHub Pages, support/privacy pages, metadata templates, and docs.
- Keep package slug, bundle ID, scheme, and link hostname unchanged.
- Publish corrected static pages and the EAS-hosted challenge landing page.

**Acceptance criteria:**

- `rg "Sudoku Offline"` returns only intentionally archived/history text.
- Store title, installed name, screenshots, support/privacy pages, and share
  landing page all say Offline Sudoku.
- Universal links still open the exact puzzle when installed and show the correct
  App Store CTA when not installed.

### BF-003 — Apple metadata and screenshot iteration

**Priority:** P1  
**Effort:** Small per experiment  
**Dependency:** BF-001 baseline

**Goal:** improve organic search coverage and product-page conversion using
measured, isolated changes.

**Scope:**

- Review search terms and territory data after launch.
- Expand the current 70-byte Apple keyword field toward the 100-byte limit
  without duplicating title/subtitle words or adding irrelevant terms.
- Test one hypothesis at a time: first screenshot message, subtitle, or keyword
  set.
- Use App Store Product Page Optimization only when traffic is sufficient for a
  useful result.

**Acceptance criteria:**

- Every experiment has a hypothesis, start date, primary metric, and stop/review
  date.
- No unsupported claims, rankings, testimonials, or misleading "ad-free" copy.
- Results and the winning/reverted variant are recorded in `docs/ASO.md`.

Official references:

- https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization
- https://developer.apple.com/help/app-store-connect/reference/app-information/app-information

## Highest-leverage product work

### BF-101 — Native rating prompt

**Priority:** P1  
**Effort:** Small  
**Target:** 1.0.1  
**Dependency:** Public App Store release

**Goal:** earn ratings at moments of demonstrated satisfaction without nagging.

**Recommended trigger:** after a successful completion once the player has
completed at least three puzzles across at least two sessions. Do not prompt on
first launch, after a failed/abandoned game, directly after an ad, during a
purchase flow, or more than once per app-defined cooldown.

**Scope:**

- Add the SDK 56-compatible store-review package.
- Add locally persisted eligibility and last-attempt state.
- Ask the OS to present its native review sheet; do not build a custom star
  selector or gate negative users away from the store.
- Treat the API as best-effort because the OS may suppress the prompt.

**Acceptance criteria:**

- Eligibility logic is pure and unit-tested.
- The prompt request never blocks completion or navigation.
- Resetting stats does not accidentally create repeated review prompts.
- Simulator verification confirms eligible and ineligible paths without relying
  on the OS sheet actually appearing.
- Privacy disclosures do not change.

Official reference:
https://developer.apple.com/app-store/ratings-and-reviews/

### BF-102 — Challenge/share-loop polish

**Priority:** P1  
**Effort:** Small  
**Target:** 1.0.1 plus static web deploy  
**Dependency:** BF-002

**Goal:** turn successful puzzle sharing into a reliable organic acquisition
loop.

**Scope:**

- Make the challenge landing page explain the target clearly and show a prominent
  App Store button.
- Preserve the exact-puzzle deep link and time/mistake target.
- Add source tagging that can be measured without collecting personal data.
- Ensure ordinary, daily, and challenge shares all have coherent fallback copy.

**Acceptance criteria:**

- Installed-device links open the intended puzzle.
- Not-installed links show Offline Sudoku branding and a valid store URL.
- Malformed or unavailable puzzle references degrade to a safe playable path.
- Share and landing behavior remains useful without an account or backend.

### BF-103 — Recent game history

**Priority:** P2  
**Effort:** Small-medium  
**Dependency:** Rating prompt can ship independently

**Goal:** add visible value from data already retained in `completed_games`.

**Scope:**

- Add a paginated/reasonably capped Recent Games section from Stats.
- Show date, difficulty, time when enabled, mistakes when tracked, hints, and
  daily/challenge context.
- Decide explicitly whether history rows are summaries only or can reopen a
  completed board. Prefer summaries for the first version.
- Keep Reset Stats behavior explicit: it currently deletes completed history.

**Acceptance criteria:**

- Repository query ordering and limits are unit-tested.
- Empty, populated, and large-history states render correctly.
- Existing users require no destructive migration.
- List performance remains acceptable with a large local history.
- Documentation and reset confirmation explain that history is removed with
  stats.

## Android release program

### BF-201 — Play Console and closed-test setup

**Priority:** P1  
**Effort:** Small operationally, potentially 14+ elapsed days  
**Dependency:** Google Play developer account

**Goal:** start the longest external lead-time early.

**Scope:**

- Determine whether the developer account is subject to the new-personal-account
  closed-test requirement.
- Create the Play Console app and internal/closed tracks.
- If required, recruit at least 12 testers and keep them opted into the closed
  test continuously for at least 14 days before applying for production access.
- Document account ownership, tester process, and production-access status
  without committing private emails or credentials.

**Acceptance criteria:**

- Play app record and appropriate test track exist.
- Required tester clock is running or documented as not applicable.
- A named owner monitors tester continuity and Play Console feedback.

Official reference:
https://support.google.com/googleplay/android-developer/answer/14151465

### BF-202 — Android production configuration

**Priority:** P1  
**Effort:** Medium  
**Dependency:** BF-201 and explicit Android verification authorization

**Goal:** produce a policy-compliant release AAB with production services.

**Scope:**

- Create the Android AdMob app and separate native/rewarded placements; replace
  Google's test app/unit IDs only in production configuration.
- Create and test the Play Billing `remove_ads` non-consumable.
- Configure the EAS Android submit profile and secure Play service account.
- Confirm app signing, API target, notification icon/channel, app links, adaptive
  icons, predictive back behavior, offline SQLite, ads, purchases, and restores.
- Add Android-specific verification instructions to `AGENTS.md` before running
  Android release QA.

**Acceptance criteria:**

- Production AAB installs through a Play testing track.
- Pre-launch report has no unresolved blocker.
- Test devices receive test ads; production IDs are not clicked during QA.
- Purchase and restore work for licensed testers.
- Android app links resolve to the intended puzzle.

### BF-203 — Google Play listing and compliance

**Priority:** P1  
**Effort:** Medium  
**Dependency:** BF-201; can proceed alongside BF-202

**Goal:** prepare a complete, accurate, conversion-focused Play listing.

**Scope:**

- Adapt the existing ASO draft to the current Offline Sudoku brand and feature
  set.
- Produce phone screenshots, app icon, and feature graphic.
- Complete Data Safety, ads declaration, content rating, target audience,
  privacy-policy, app-access, pricing, countries, and IAP declarations.
- Keep claims consistent with optional native/rewarded ads.

**Acceptance criteria:**

- Listing fields meet current Google character and asset limits.
- Data Safety matches AdMob, EAS Insights, local SQLite data, and IAP behavior.
- Store copy promises only shipped Android behavior.
- Internal/closed-track listing is reviewed on a physical Android device before
  production application.

Official references:

- https://support.google.com/googleplay/android-developer/answer/9859152
- https://support.google.com/googleplay/android-developer/answer/13393723
- https://support.google.com/googleplay/android-developer/answer/9866151

## Localization program

### BF-301 — Localization foundation

**Priority:** P2  
**Effort:** Medium  
**Dependency:** Stable Offline Sudoku naming

**Goal:** make app and store strings locale-driven before adding translations.

**Scope:**

- Inventory every user-facing string, including accessibility labels,
  notifications, alerts, settings, ads/IAP copy, share text, and web fallbacks.
- Introduce a typed locale catalog with English as the source locale.
- Add locale-aware date/time and plural formatting without changing persisted
  daily date keys.
- Keep puzzle content and core play independent of localization.
- Ensure screenshot seeding can launch deterministically in a requested locale.

**Acceptance criteria:**

- No user-facing app string is unintentionally hardcoded outside the catalog.
- Missing translations fall back to English.
- Daily selection and streak behavior are unchanged across timezone/locale
  combinations.
- Long-string and pseudo-localized layouts remain usable on supported iPhones and
  iPads.

### BF-302 — First localized markets

**Priority:** P2  
**Effort:** Medium  
**Dependency:** BF-301 and BF-001 territory baseline

**Goal:** expand organic reach with a small, high-quality first batch.

**Initial candidate locales:** Spanish (`es-ES`, then `es-MX` if copy differs),
Brazilian Portuguese (`pt-BR`), German (`de-DE`), and French (`fr-FR`). Confirm
the order against actual territory impressions/downloads before assignment.

**Scope per locale:**

- Translate the app catalog, notification copy, App Store metadata, screenshot
  captions, support basics, and privacy-policy summary/path.
- Research native search terms; do not directly translate the English keyword
  list.
- Have a fluent reviewer approve the first three screenshots and all purchase,
  ad, reminder, reset, and privacy wording.

**Acceptance criteria:**

- App Store metadata and screenshots are complete for the locale.
- Native review covers all high-risk and conversion-critical strings.
- The app passes an iOS simulator smoke test in that locale.
- Truncation, date formatting, pluralization, and accessibility labels are
  checked.

Official reference:
https://developer.apple.com/help/app-store-connect/manage-app-information/localize-app-information

## Validate before building

### BF-401 — Achievement discovery and specification

**Priority:** P3  
**Effort:** Small discovery; medium implementation  
**Dependency:** Post-launch retention/review evidence

**Goal:** determine whether achievements solve a real retention problem before
adding a badge system.

**Discovery questions:**

- Do reviews or support requests ask for goals, milestones, or progression?
- Do daily streak and existing stats already provide enough progression?
- Can achievements be derived from retained local data without fragile counters?
- Which 6–10 achievements reward healthy play instead of hint/ad grinding?

**Implementation gate:** proceed only with evidence or a clearly defined product
hypothesis and success metric. Prefer locally derived, retroactive achievements;
avoid Game Center/backend scope initially.

### BF-402 — Remote product analytics decision

**Priority:** P3  
**Effort:** Small decision, medium implementation  
**Dependency:** Questions that App Store Connect and EAS Insights cannot answer

**Goal:** avoid adding tracking infrastructure without a decision it enables.

**Scope:** define the minimum unanswered funnel/retention questions, compare a
privacy-preserving event sink against aggregate/no-backend alternatives, and
document required privacy/App Store disclosure changes before implementation.

**Acceptance criteria:** a written go/no-go decision names the exact metrics,
retention period, identifiers, consent/disclosure impact, cost, and deletion
policy.

### BF-403 — Streak restore and challenge archive reassessment

**Priority:** P3  
**Effort:** Medium-large  
**Dependency:** Measured daily retention and rewarded-ad usage

**Goal:** decide whether the planned features in
[`retention-monetization.md`](./retention-monetization.md) improve retention
enough to justify migration and monetization complexity.

Do not implement until data shows meaningful streak loss or archive demand. If
approved, split the work into schema/domain, streak restore, archive UI, ad/IAP
entitlement behavior, and migration tests rather than assigning the whole plan to
one agent.

## Recommended assignment sequence

1. BF-001 immediately after approval; BF-002 can start now.
2. BF-201 now if the Play account exists, because its elapsed-time requirement
   may dominate the Android schedule.
3. BF-101 and BF-102 for 1.0.1.
4. BF-003 after a baseline is available.
5. BF-202 and BF-203 in parallel once Android verification is authorized.
6. BF-301, then assign one locale at a time under BF-302.
7. BF-103 when acquisition/release work is stable.
8. Revisit BF-401 through BF-403 only with post-launch evidence.
