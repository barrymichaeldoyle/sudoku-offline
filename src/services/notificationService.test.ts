jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue("id"),
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("@/data/repositories/dailyRepository", () => ({
  getDailyProgress: jest.fn(),
  getCompletedDailyDateKeys: jest.fn(),
}));
jest.mock("@/services/dailyService", () => ({
  getLocalDateKey: jest.fn(() => "2026-07-05"),
}));
jest.mock("@/services/analyticsService", () => ({ track: jest.fn() }));

import * as Notifications from "expo-notifications";

import { getCompletedDailyDateKeys, getDailyProgress } from "@/data/repositories/dailyRepository";
import { DEFAULT_SETTINGS, type Settings } from "@/domain/settings";

import { syncDailyReminderSchedule } from "./notificationService";

const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockGetDailyProgress = getDailyProgress as jest.Mock;
const mockGetCompletedDailyDateKeys = getCompletedDailyDateKeys as jest.Mock;

const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  dailyReminderEnabled: true,
  dailyReminderTimeMinutes: 9 * 60,
};

/** Scheduled calls for one identifier ("daily-puzzle-reminder" / "streak-save-reminder"). */
function scheduledWithId(identifier: string): Record<string, unknown>[] {
  return mockSchedule.mock.calls.map(([arg]) => arg).filter((arg) => arg.identifier === identifier);
}

describe("syncDailyReminderSchedule streak save", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 2026-07-05 14:00 local: before the 20:30 streak-save slot.
    jest.useFakeTimers({ now: new Date(2026, 6, 5, 14, 0, 0) });
    mockGetPermissions.mockResolvedValue({ granted: true });
    mockGetDailyProgress.mockResolvedValue(null); // today's daily unfinished
    mockGetCompletedDailyDateKeys.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("schedules the evening last call when a streak is at risk", async () => {
    mockGetCompletedDailyDateKeys.mockResolvedValue(["2026-07-03", "2026-07-04"]);
    await syncDailyReminderSchedule(SETTINGS);
    const [call] = scheduledWithId("streak-save-reminder");
    expect(call).toBeDefined();
    expect((call.content as { title: string }).title).toBe("Your 2-day streak ends at midnight");
    expect((call.trigger as { date: Date }).date).toEqual(new Date(2026, 6, 5, 20, 30, 0, 0));
  });

  it("does not schedule it when there is no streak to save", async () => {
    mockGetCompletedDailyDateKeys.mockResolvedValue(["2026-07-01"]); // streak already dead
    await syncDailyReminderSchedule(SETTINGS);
    expect(scheduledWithId("streak-save-reminder")).toHaveLength(0);
    expect(scheduledWithId("daily-puzzle-reminder")).toHaveLength(1);
  });

  it("targets tomorrow evening after a just-completed first daily, even before the write lands", async () => {
    // DB still says nothing is completed; the completion screen passes the key.
    await syncDailyReminderSchedule(SETTINGS, "2026-07-05");
    const [call] = scheduledWithId("streak-save-reminder");
    expect(call).toBeDefined();
    expect((call.content as { title: string }).title).toBe("Your streak ends at midnight");
    expect((call.trigger as { date: Date }).date).toEqual(new Date(2026, 6, 6, 20, 30, 0, 0));
  });

  it("skips it for users whose own reminder already fires in the evening", async () => {
    mockGetCompletedDailyDateKeys.mockResolvedValue(["2026-07-04"]);
    await syncDailyReminderSchedule({ ...SETTINGS, dailyReminderTimeMinutes: 20 * 60 });
    expect(scheduledWithId("streak-save-reminder")).toHaveLength(0);
  });
});
