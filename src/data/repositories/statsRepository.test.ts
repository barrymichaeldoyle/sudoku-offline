jest.mock("../db/client", () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from "../db/client";
import { getCompletedGameStats, getDailyTrackStats } from "./statsRepository";

const mockGetDatabase = getDatabase as jest.Mock;

describe("statsRepository", () => {
  beforeEach(() => {
    mockGetDatabase.mockReset();
  });

  it("scopes normal stats to non-daily games so dailies never inflate them", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({ getAllAsync });

    const stats = await getCompletedGameStats();

    // The Normal bucket must exclude daily games (which carry a date_key).
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("date_key IS NULL"));
    // No play yet → only the four pickable difficulties, all zeroed (no extreme).
    expect(Object.keys(stats.byDifficulty).sort()).toEqual(["easy", "expert", "hard", "medium"]);
    expect(stats.totalCompleted).toBe(0);
  });

  it("aggregates daily stats per track from daily_progress", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([
      { track: "daily", completed: 7, best: 300, avg: 360.4, total: 2520, mistake_free: 4 },
      { track: "challenge", completed: 2, best: 1500, avg: 1545, total: 3090, mistake_free: 1 },
    ]);
    mockGetDatabase.mockResolvedValue({ getAllAsync });

    const byTrack = await getDailyTrackStats();

    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("FROM daily_progress"));
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("GROUP BY track"));
    expect(byTrack.daily.completed).toBe(7);
    expect(byTrack.daily.averageSeconds).toBe(360); // rounded
    expect(byTrack.challenge.completed).toBe(2);
    expect(byTrack.challenge.bestSeconds).toBe(1500);
  });
});
