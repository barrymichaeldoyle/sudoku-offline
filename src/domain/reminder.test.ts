import {
  formatReminderTime,
  nextReminderDate,
  nextStreakSaveDate,
  reminderHourMinute,
  STREAK_SAVE_TIME_MINUTES,
} from "./reminder";

describe("reminderHourMinute", () => {
  it("splits minutes-after-midnight", () => {
    expect(reminderHourMinute(540)).toEqual([9, 0]);
    expect(reminderHourMinute(0)).toEqual([0, 0]);
    expect(reminderHourMinute(23 * 60 + 30)).toEqual([23, 30]);
  });

  it("wraps out-of-range values", () => {
    expect(reminderHourMinute(1440)).toEqual([0, 0]);
    expect(reminderHourMinute(-60)).toEqual([23, 0]);
  });
});

describe("formatReminderTime", () => {
  it("formats as a 12-hour label", () => {
    expect(formatReminderTime(540)).toBe("9:00 AM");
    expect(formatReminderTime(0)).toBe("12:00 AM");
    expect(formatReminderTime(12 * 60)).toBe("12:00 PM");
    expect(formatReminderTime(20 * 60 + 30)).toBe("8:30 PM");
  });
});

describe("nextReminderDate", () => {
  const at = (h: number, m: number) => new Date(2026, 5, 19, h, m, 0, 0);

  it("schedules today when the time is still ahead and the daily is unfinished", () => {
    const result = nextReminderDate(at(7, 0), 9 * 60, false);
    expect(result).toEqual(at(9, 0));
  });

  it("schedules tomorrow when the time has already passed", () => {
    const result = nextReminderDate(at(10, 0), 9 * 60, false);
    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(9);
  });

  it("schedules tomorrow when today's daily is already complete", () => {
    const result = nextReminderDate(at(7, 0), 9 * 60, true);
    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(9);
  });

  it("treats the exact reminder minute as already passed", () => {
    const result = nextReminderDate(at(9, 0), 9 * 60, false);
    expect(result.getDate()).toBe(20);
  });
});

describe("nextStreakSaveDate", () => {
  const at = (h: number, m: number) => new Date(2026, 5, 19, h, m, 0, 0);
  const MORNING = 9 * 60;

  it("schedules this evening when today is unfinished and 20:30 is still ahead", () => {
    const result = nextStreakSaveDate(at(14, 0), MORNING, false);
    expect(result).toEqual(at(20, 30));
  });

  it("returns null when 20:30 has passed: the streak is gone at midnight anyway", () => {
    expect(nextStreakSaveDate(at(21, 0), MORNING, false)).toBeNull();
    expect(nextStreakSaveDate(at(20, 30), MORNING, false)).toBeNull();
  });

  it("schedules tomorrow evening once today's daily is complete", () => {
    const result = nextStreakSaveDate(at(14, 0), MORNING, true);
    expect(result?.getDate()).toBe(20);
    expect(result?.getHours()).toBe(20);
    expect(result?.getMinutes()).toBe(30);
  });

  it("still targets tomorrow when completing after 20:30", () => {
    const result = nextStreakSaveDate(at(22, 0), MORNING, true);
    expect(result?.getDate()).toBe(20);
  });

  it("returns null when the user's own reminder fires within two hours of 20:30", () => {
    expect(nextStreakSaveDate(at(14, 0), 20 * 60, false)).toBeNull();
    expect(nextStreakSaveDate(at(14, 0), STREAK_SAVE_TIME_MINUTES, true)).toBeNull();
  });

  it("allows the nudge for reminder times through 6 PM", () => {
    expect(nextStreakSaveDate(at(14, 0), 12 * 60, false)).toEqual(at(20, 30));
    expect(nextStreakSaveDate(at(14, 0), 18 * 60, false)).toEqual(at(20, 30));
  });
});
