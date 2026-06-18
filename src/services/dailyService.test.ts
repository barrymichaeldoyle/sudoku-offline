import { dailyIndexForDate, daysSinceEpoch, getLocalDateKey } from "./dailyService";

describe("getLocalDateKey", () => {
  it("formats a date as YYYY-MM-DD with zero padding", () => {
    expect(getLocalDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(getLocalDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("daysSinceEpoch", () => {
  it("returns 0 at the epoch and increments by day", () => {
    expect(daysSinceEpoch("1970-01-01")).toBe(0);
    expect(daysSinceEpoch("1970-01-02")).toBe(1);
  });

  it("advances by exactly one between consecutive days", () => {
    expect(daysSinceEpoch("2026-06-19") - daysSinceEpoch("2026-06-18")).toBe(1);
  });
});

describe("dailyIndexForDate", () => {
  it("is stable for the same date and pool size", () => {
    expect(dailyIndexForDate("2026-06-18", 120)).toBe(dailyIndexForDate("2026-06-18", 120));
  });

  it("wraps within the pool bounds", () => {
    for (let i = 0; i < 200; i++) {
      const key = getLocalDateKey(new Date(2026, 0, 1 + i));
      const index = dailyIndexForDate(key, 120);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(120);
    }
  });

  it("returns 0 for an empty pool", () => {
    expect(dailyIndexForDate("2026-06-18", 0)).toBe(0);
  });
});
