import type { Settings } from "@/domain/settings";

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getCompletedDailyDateKeys, getDailyProgress } from "@/data/repositories/dailyRepository";
import { nextReminderDate, nextStreakSaveDate } from "@/domain/reminder";
import { computeStreak } from "@/domain/streak";
import { track } from "@/services/analyticsService";
import { getLocalDateKey } from "@/services/dailyService";

/** Fixed identifiers so a reschedule replaces (not duplicates) our reminders,
 * and we can cancel ours without touching anything else the OS has scheduled. */
const DAILY_REMINDER_ID = "daily-puzzle-reminder";
const STREAK_SAVE_REMINDER_ID = "streak-save-reminder";
const ANDROID_CHANNEL_ID = "daily-reminders";

/** Deep-link target for a reminder tap — Home resolves it to today's daily. */
export const DAILY_REMINDER_URL = "/?daily=1";

const isWeb = Platform.OS === "web";

// Present the reminder as a banner even if the app happens to be foregrounded.
// It is local-only, so keep it quiet (no sound, no badge).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android 13+ won't show the OS permission prompt until a channel exists, so
// this must run before requesting permission and before scheduling.
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Daily reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function isGranted(settings: Notifications.NotificationPermissionsStatus): boolean {
  return (
    settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Ask for notification permission as part of turning the reminder on. Returns
 * whether we ended up with permission. Safe to call when already granted.
 */
export async function requestDailyReminderPermission(): Promise<boolean> {
  if (isWeb) {
    return false;
  }
  void track("daily_reminder_permission_requested");
  await ensureAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  let granted = isGranted(existing);
  if (!granted && existing.canAskAgain !== false) {
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    granted = isGranted(result);
  }
  void track(granted ? "daily_reminder_permission_granted" : "daily_reminder_permission_denied");
  return granted;
}

async function hasPermission(): Promise<boolean> {
  if (isWeb) {
    return false;
  }
  return isGranted(await Notifications.getPermissionsAsync());
}

/** Cancel just our scheduled reminders (no-op if none are pending). */
export async function cancelDailyReminder(): Promise<void> {
  if (isWeb) {
    return;
  }
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(STREAK_SAVE_REMINDER_ID).catch(() => {}),
  ]);
}

async function isTodayDailyComplete(): Promise<boolean> {
  const progress = await getDailyProgress(getLocalDateKey(), "daily");
  return progress?.completedAt != null;
}

/**
 * Whether it's worth showing the one-time soft "want a daily reminder?" prompt.
 * Only when we can actually still show the OS permission dialog — not on web,
 * not if already granted, and not if the user has permanently denied at the OS
 * level (where the prompt would be a dead end).
 */
export async function canOfferReminderPrompt(): Promise<boolean> {
  if (isWeb) {
    return false;
  }
  const perms = await Notifications.getPermissionsAsync();
  if (isGranted(perms)) {
    return false;
  }
  return perms.canAskAgain !== false;
}

/**
 * Reconcile the scheduled reminders (the daily nudge plus the evening
 * streak-save "last call") with current state. Safe — and meant — to be called
 * often: on boot, when the setting/time changes, when today's daily is started
 * or completed, and when the app returns to the foreground. It cancels any
 * pending reminders, then schedules the next opportunities only when the
 * feature is on, permission is granted, and there is still a reason to remind.
 *
 * `justCompletedDailyDateKey` lets the completion screen flag a win whose
 * database write may not have landed yet, so the reconcile never re-nags about
 * (or miscounts the streak of) a daily the player literally just finished.
 */
export async function syncDailyReminderSchedule(
  settings: Settings,
  justCompletedDailyDateKey?: string,
): Promise<void> {
  if (isWeb) {
    return;
  }
  try {
    await cancelDailyReminder();
    if (!settings.dailyReminderEnabled || !(await hasPermission())) {
      return;
    }
    const todayKey = getLocalDateKey();
    const todayComplete = justCompletedDailyDateKey === todayKey || (await isTodayDailyComplete());
    const now = new Date();
    const date = nextReminderDate(now, settings.dailyReminderTimeMinutes, todayComplete);
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: "Today's Sudoku is ready",
        body: "Keep your daily streak going.",
        data: { url: DAILY_REMINDER_URL, source: "daily_reminder" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
    void track("daily_reminder_scheduled", { at: date.toISOString() });
    await scheduleStreakSaveReminder(
      settings,
      now,
      todayKey,
      todayComplete,
      justCompletedDailyDateKey,
    );
  } catch {
    // Reminders are a retention nicety — a scheduling failure must never surface
    // to the player or break the offline game.
  }
}

/**
 * The evening "last call": one extra notification at 20:30 local, scheduled
 * only while there is actually a streak on the line — an alive streak and an
 * unfinished daily on the evening it would fire. Players whose own reminder
 * time is already an evening one never get it (see `nextStreakSaveDate`).
 */
async function scheduleStreakSaveReminder(
  settings: Settings,
  now: Date,
  todayKey: string,
  todayComplete: boolean,
  justCompletedDailyDateKey?: string,
): Promise<void> {
  const date = nextStreakSaveDate(now, settings.dailyReminderTimeMinutes, todayComplete);
  if (!date) {
    return;
  }
  const dailyKeys = await getCompletedDailyDateKeys("daily");
  if (justCompletedDailyDateKey) {
    dailyKeys.push(justCompletedDailyDateKey); // computeStreak dedupes
  }
  const streak = computeStreak(dailyKeys, todayKey);
  if (streak.current === 0) {
    return;
  }
  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_SAVE_REMINDER_ID,
    content: {
      title:
        streak.current === 1
          ? "Your streak ends at midnight"
          : `Your ${streak.current}-day streak ends at midnight`,
      body: "Finish today's Sudoku to keep it going.",
      data: { url: DAILY_REMINDER_URL, source: "streak_save_reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
  void track("streak_save_reminder_scheduled", {
    at: date.toISOString(),
    streak: streak.current,
  });
}

/** The most recent notification response (a tap), if the app was opened by one. */
export function getLastNotificationResponseAsync(): Promise<Notifications.NotificationResponse | null> {
  if (isWeb) {
    return Promise.resolve(null);
  }
  return Notifications.getLastNotificationResponseAsync();
}

/** Subscribe to notification taps; returns an unsubscribe function. */
export function addNotificationTapListener(
  handler: (response: Notifications.NotificationResponse) => void,
): () => void {
  if (isWeb) {
    return () => {};
  }
  const subscription = Notifications.addNotificationResponseReceivedListener(handler);
  return () => subscription.remove();
}
