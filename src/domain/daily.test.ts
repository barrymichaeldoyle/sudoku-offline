import {
  dailyTrackCompletionHeading,
  dailyTrackStatValue,
  dailyTrackSummaryLabel,
  inferDailyTrackFromPuzzleId,
} from "./daily";

describe("daily presentation helpers", () => {
  it("infers the daily track from bundled pool ids", () => {
    expect(inferDailyTrackFromPuzzleId("daily_0003")).toBe("daily");
    expect(inferDailyTrackFromPuzzleId("challenge_0002")).toBe("challenge");
    expect(inferDailyTrackFromPuzzleId("medium_0007")).toBeNull();
  });

  it("labels the daily puzzle track consistently", () => {
    expect(dailyTrackStatValue("daily")).toBe("Puzzle");
    expect(dailyTrackSummaryLabel("daily")).toBe("Daily Puzzle");
    expect(dailyTrackCompletionHeading("daily")).toBe("Daily Puzzle Complete");
  });

  it("labels the daily challenge track consistently", () => {
    expect(dailyTrackStatValue("challenge")).toBe("Challenge");
    expect(dailyTrackSummaryLabel("challenge")).toBe("Daily Challenge");
    expect(dailyTrackCompletionHeading("challenge")).toBe("Daily Challenge Complete");
  });
});
