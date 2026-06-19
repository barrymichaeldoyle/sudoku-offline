# Push Notifications - Daily Puzzle Reminder (planned)

> Retention feature for bringing players back to the daily puzzle without making
> the app feel noisy. **Not yet built.** This should be an opt-in setting, use
> local scheduling first, and keep the core game fully playable offline.

Pairs with [`handover.md`](./handover.md) (phase status),
[`retention-monetization.md`](./retention-monetization.md) (reward-ad retention
ideas), and the Expo SDK 56
[`expo-notifications`](https://docs.expo.dev/versions/v56.0.0/sdk/notifications/)
docs.

---

## Goal

Increase daily puzzle retention by reminding opted-in users when today's Daily
Puzzle is still unfinished.

The first implementation should be **local notifications**, not remote push:

- The daily puzzle is deterministic and available offline.
- A reminder can be scheduled on-device after the user opts in.
- No backend, push-token storage, APNs, or FCM integration is required.
- It keeps the privacy posture simple: no account, no remote audience targeting.

Remote push can be added later for campaigns, announcements, or reactivation
experiments that cannot be expressed as on-device schedules.

---

## Product behavior

### User setting

Add a Settings section for reminders:

- `Daily puzzle reminder` - main toggle, default `false`.
- `Reminder time` - local wall-clock time, default `09:00`.
- Optional later: `Challenge reminder` for the extreme Daily Challenge, kept
  separate from the streak-driving Daily Puzzle.

Turning the main toggle on should:

1. Explain the value in plain language.
2. Request notification permission.
3. If permission is granted, schedule the reminder.
4. If permission is denied, leave the app-level setting off and show a clear
   path to system settings if we add one later.

Turning the toggle off should cancel the app's scheduled reminder notifications.

### Reminder rules

- Send at the user's selected local time only when today's `track='daily'`
  progress is not complete.
- Do not notify after the user completes today's daily.
- Do not use reminders for ordinary difficulty games.
- Keep copy calm and specific:
  - Title: `Today's Sudoku is ready`
  - Body: `Keep your daily streak going.`
- Notification tap should deep link to the daily puzzle entry point. If a daily
  game for today already exists, resume it; otherwise create today's daily game.

### Frequency guardrails

- One scheduled reminder per day is enough.
- No streak-loss countdowns, repeated nags, or completion-time notifications for
  the initial version.
- If the user disables reminders, do not ask again automatically. Re-enable only
  from Settings.

---

## Expo SDK 56 implementation notes

Use `expo-notifications` (`npx expo install expo-notifications`). The SDK 56
package supports scheduling local notifications, notification response listeners,
Android channels, Expo push tokens, and notification presentation control.

Relevant SDK 56 details to account for:

- Remote push is unavailable in Expo Go on Android from SDK 53 onward; development
  builds are required for remote push. Local notifications still work in Expo Go.
- Android 13+ does not show the OS notification permission prompt until at least
  one notification channel exists. Create the channel before requesting
  permission.
- Android exact-time alarms require `SCHEDULE_EXACT_ALARM`; avoid exact-alarm
  dependency unless testing proves inexact calendar triggers are insufficient.
- The `expo-notifications` config plugin is needed for native notification icon,
  color, default channel, custom sounds, or iOS background remote notification
  capability. The daily reminder does not need background remote notifications.
- Expo Router can handle notification taps by reading a URL from
  `notification.request.content.data.url` in the root layout and routing to it.

Suggested app config addition when implementing:

```json
[
  "expo-notifications",
  {
    "icon": "./assets/images/android-icon-monochrome.png",
    "color": "#208AEF",
    "defaultChannel": "daily-reminders",
    "enableBackgroundRemoteNotifications": false
  }
]
```

Validate the Android icon asset before shipping: Expo expects an all-white PNG
with transparency for the notification icon. The current monochrome app icon may
need a dedicated 96x96 notification asset.

---

## Proposed data model

Extend `Settings`:

```ts
type Settings = {
  // existing fields...
  dailyReminderEnabled: boolean;
  dailyReminderTimeMinutes: number; // minutes after local midnight, default 9 * 60
};
```

The settings blob is already forward-compatible via `normalizeSettings`, so this
is an additive setting change with no SQLite migration.

Add a small notification service:

```ts
export async function syncDailyReminderSchedule(settings: Settings): Promise<void>;
export async function requestDailyReminderPermission(): Promise<boolean>;
export async function cancelDailyReminder(): Promise<void>;
export function useNotificationResponseObserver(): void;
```

Store notification identifiers only if needed. Prefer deterministic identifiers
or cancel-by-known-category where the Expo API supports it cleanly; otherwise add
the scheduled notification id to the settings blob or a `schema_meta` key.

---

## Scheduling approach

The app needs the reminder to be conditional on daily completion. There are two
reasonable approaches:

### Recommended v1: schedule next reminder opportunistically

Reschedule the next reminder whenever:

- app boots after settings hydrate,
- reminder setting/time changes,
- today's daily is started,
- today's daily is completed,
- app returns to foreground.

At scheduling time:

1. Cancel existing daily reminder notification(s).
2. If reminders are disabled or permission is not granted, stop.
3. If today's daily is complete, schedule tomorrow's reminder.
4. Otherwise schedule today's reminder if the selected time has not passed; if it
   has passed, schedule tomorrow's reminder.

This keeps the content accurate without background tasks.

### Later: repeating calendar trigger

A repeating daily trigger is simpler, but it cannot know whether today's puzzle
was completed before the notification fires. Use it only if the product accepts a
generic reminder that may appear after completion, or pair it with foreground
rescheduling and cancellation.

---

## Navigation

Use notification data with an internal route:

```ts
data: { url: "/?daily=1", source: "daily_reminder" }
```

Root layout observer:

- Check `Notifications.getLastNotificationResponse()` on launch.
- Listen with `Notifications.addNotificationResponseReceivedListener`.
- Route through Expo Router.

Home should own the final launch behavior so notification taps reuse the same
daily creation/resume logic as the visible Daily Puzzle button.

---

## Analytics events

Add local queued events:

- `daily_reminder_permission_requested`
- `daily_reminder_permission_granted`
- `daily_reminder_permission_denied`
- `daily_reminder_enabled`
- `daily_reminder_disabled`
- `daily_reminder_time_changed`
- `daily_reminder_scheduled`
- `daily_reminder_tapped`

Keep these local until a real analytics sink exists.

---

## Testing checklist

- Unit test settings normalization defaults.
- Unit test schedule decision logic with dates before/after the reminder time and
  with complete/incomplete daily progress.
- Mock `expo-notifications` in service tests.
- Manual iOS and Android checks in development builds:
  - first opt-in permission flow,
  - denied permission path,
  - reminder time change cancels the old notification,
  - daily completion cancels or skips today's pending notification,
  - notification tap opens/resumes today's daily puzzle,
  - app remains useful offline.

---

## Locked decisions

- Reminders are equal for everyone. Premium users should not get richer reminder
  customization; retention should not feel like an upsell.
- The Daily Challenge can get its own reminder later, but only as a separate
  setting that is off by default.
- Missed-day recovery reminders are out of scope for v1. Keep the first version
  focused on the daily habit, not pressure.
