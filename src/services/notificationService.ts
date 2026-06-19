import type { Settings } from "@/domain/settings";

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getDailyProgress } from "@/data/repositories/dailyRepository";
import { nextReminderDate } from "@/domain/reminder";
import { track } from "@/services/analyticsService";
import { getLocalDateKey } from "@/services/dailyService";

/** Fixed identifier so a reschedule replaces (not duplicates) our reminder, and
 * we can cancel ours without touching anything else the OS has scheduled. */
const DAILY_REMINDER_ID = "daily-puzzle-reminder";
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

/** Cancel just our scheduled reminder (no-op if none is pending). */
export async function cancelDailyReminder(): Promise<void> {
  if (isWeb) {
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
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
 * Reconcile the single scheduled daily reminder with current state. Safe — and
 * meant — to be called often: on boot, when the setting/time changes, when
 * today's daily is started or completed, and when the app returns to the
 * foreground. It cancels any pending reminder, then schedules the next
 * opportunity only when the feature is on, permission is granted, and there is
 * still a reason to remind (today's daily isn't finished yet).
 */
export async function syncDailyReminderSchedule(settings: Settings): Promise<void> {
  if (isWeb) {
    return;
  }
  try {
    await cancelDailyReminder();
    if (!settings.dailyReminderEnabled || !(await hasPermission())) {
      return;
    }
    const todayComplete = await isTodayDailyComplete();
    const date = nextReminderDate(new Date(), settings.dailyReminderTimeMinutes, todayComplete);
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
  } catch {
    // Reminders are a retention nicety — a scheduling failure must never surface
    // to the player or break the offline game.
  }
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
