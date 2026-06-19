import { computeStreak } from "./streak";

describe("computeStreak", () => {
  it("returns zeros for no completions", () => {
    expect(computeStreak([], "2026-06-19")).toEqual({ current: 0, longest: 0 });
  });

  it("counts a single completion today as a streak of 1", () => {
    expect(computeStreak(["2026-06-19"], "2026-06-19")).toEqual({ current: 1, longest: 1 });
  });

  it("keeps the streak alive when yesterday is done but today is not", () => {
    expect(computeStreak(["2026-06-17", "2026-06-18"], "2026-06-19")).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("resets the current streak when the last completion is older than yesterday", () => {
    expect(computeStreak(["2026-06-15", "2026-06-16"], "2026-06-19")).toEqual({
      current: 0,
      longest: 2,
    });
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-06-17", "2026-06-18", "2026-06-19"], "2026-06-19")).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it("breaks the current run on a gap but tracks the longest historical run", () => {
    const keys = ["2026-06-10", "2026-06-11", "2026-06-12", "2026-06-18", "2026-06-19"];
    expect(computeStreak(keys, "2026-06-19")).toEqual({ current: 2, longest: 3 });
  });

  it("ignores duplicate completions for the same day", () => {
    expect(computeStreak(["2026-06-19", "2026-06-19"], "2026-06-19")).toEqual({
      current: 1,
      longest: 1,
    });
  });

  it("handles unsorted input", () => {
    expect(computeStreak(["2026-06-19", "2026-06-17", "2026-06-18"], "2026-06-19")).toEqual({
      current: 3,
      longest: 3,
    });
  });
});
