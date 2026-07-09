import { dailyTrackCompletionHeading, dailyTrackStatValue, dailyTrackSummaryLabel } from "./daily";

describe("daily presentation helpers", () => {
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
