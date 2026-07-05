/**
 * Pure scheduling logic for the daily-puzzle reminder, kept free of any
 * `expo-notifications` dependency so it can be unit-tested directly. See
 * `services/notificationService.ts` for the side-effecting scheduler and
 * `docs/push-notifications.md` for the product rules.
 */

/** Split minutes-after-midnight into [hour, minute]. */
export function reminderHourMinute(timeMinutes: number): [hour: number, minute: number] {
  const safe = ((Math.floor(timeMinutes) % 1440) + 1440) % 1440;
  return [Math.floor(safe / 60), safe % 60];
}

/** Friendly 12-hour label for a reminder time, e.g. 540 → "9:00 AM". */
export function formatReminderTime(timeMinutes: number): string {
  const [hour, minute] = reminderHourMinute(timeMinutes);
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * The next moment a daily reminder should fire, given the current time, the
 * user's chosen reminder time, and whether today's Daily Puzzle is already done.
 *
 * - If today's daily is complete, skip to tomorrow — no nag after a win.
 * - Otherwise fire today when the chosen time is still ahead; if it has already
 *   passed, fire tomorrow.
 */
export function nextReminderDate(now: Date, timeMinutes: number, todayComplete: boolean): Date {
  const [hour, minute] = reminderHourMinute(timeMinutes);
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (todayComplete || target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/** The evening "last call" streak-save nudge fires at 20:30 local. */
export const STREAK_SAVE_TIME_MINUTES = 20 * 60 + 30;

/** Skip the streak save when the user's own reminder time is this close to it
 * (or past it): their reminder is already the evening ping, and two
 * notifications in one evening is how people end up revoking permission. */
const STREAK_SAVE_OVERLAP_MINUTES = 120;

/**
 * The next moment the evening streak-save nudge should fire, or null when it
 * shouldn't be scheduled at all. Callers gate separately on there actually
 * being a streak to save.
 *
 * - If today's daily is done, the streak is next at risk tomorrow evening.
 * - Otherwise fire this evening, unless 20:30 has already passed: the streak
 *   dies at midnight, so there is nothing left to save tomorrow.
 * - Never scheduled when the user's chosen reminder time is itself an evening
 *   one (within two hours of 20:30, or later).
 */
export function nextStreakSaveDate(
  now: Date,
  reminderTimeMinutes: number,
  todayComplete: boolean,
): Date | null {
  if (reminderTimeMinutes >= STREAK_SAVE_TIME_MINUTES - STREAK_SAVE_OVERLAP_MINUTES) {
    return null;
  }
  const [hour, minute] = reminderHourMinute(STREAK_SAVE_TIME_MINUTES);
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (todayComplete) {
    target.setDate(target.getDate() + 1);
    return target;
  }
  return target.getTime() > now.getTime() ? target : null;
}
