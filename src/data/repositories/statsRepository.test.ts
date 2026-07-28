jest.mock("../db/client", () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from "../db/client";
import {
  getCompletedGameCount,
  getCompletedGameStats,
  getDailyTrackStats,
  getRecentGames,
} from "./statsRepository";

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

  it("returns recent runs newest-first and only reopens the retained matching board", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: "completion-1",
        game_id: "game-1",
        difficulty: "hard",
        date_key: "2026-07-28",
        daily_track: "challenge",
        elapsed_seconds: 900,
        mistakes: 2,
        hints_used: 1,
        completed_at: "2026-07-28T12:00:00.000Z",
        can_reopen: 1,
      },
      {
        id: "completion-0",
        game_id: "game-1",
        difficulty: "hard",
        date_key: null,
        daily_track: null,
        elapsed_seconds: 1100,
        mistakes: 3,
        hints_used: 0,
        completed_at: "2026-07-20T12:00:00.000Z",
        can_reopen: 0,
      },
    ]);
    mockGetDatabase.mockResolvedValue({ getAllAsync });

    const recent = await getRecentGames({ limit: 250 });

    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY cg.completed_at DESC"),
      100,
      0,
    );
    expect(getAllAsync.mock.calls[0][0]).toContain("g.completed_at = cg.completed_at");
    expect(getAllAsync.mock.calls[0][0]).toContain("LEFT JOIN games");
    expect(recent[0]).toMatchObject({
      gameId: "game-1",
      dailyTrack: "challenge",
      canReopen: true,
    });
    expect(recent[1].canReopen).toBe(false);
  });

  it("keeps completion summaries when the retained game no longer exists", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        id: "completion-only",
        game_id: "deleted-game",
        difficulty: "medium",
        date_key: null,
        daily_track: null,
        elapsed_seconds: 420,
        mistakes: 0,
        hints_used: 0,
        completed_at: "2026-07-28T12:00:00.000Z",
        can_reopen: 0,
      },
    ]);
    mockGetDatabase.mockResolvedValue({ getAllAsync });

    const recent = await getRecentGames();

    expect(getAllAsync.mock.calls[0][0]).toContain("LEFT JOIN games");
    expect(recent).toEqual([
      expect.objectContaining({
        id: "completion-only",
        canReopen: false,
      }),
    ]);
  });

  it("falls back to the default recent-game limit for invalid input", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({ getAllAsync });

    await getRecentGames({ limit: Number.NaN, offset: Number.NaN });

    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), 20, 0);
  });

  it("filters daily history without interpolating user input", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({ getAllAsync });

    await getRecentGames({ filter: "daily", limit: 11 });

    expect(getAllAsync.mock.calls[0][0]).toContain("cg.date_key IS NOT NULL");
    expect(getAllAsync.mock.calls[0].slice(1)).toEqual([11, 0]);
  });

  it("binds a difficulty filter and supports offsets", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({ getAllAsync });

    await getRecentGames({ filter: "hard", limit: 10, offset: 20 });

    expect(getAllAsync.mock.calls[0][0]).toContain("cg.difficulty = ?");
    expect(getAllAsync.mock.calls[0].slice(1)).toEqual(["hard", 10, 20]);
  });

  it("counts completed runs for review eligibility", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ count: 3 });
    mockGetDatabase.mockResolvedValue({ getFirstAsync });

    await expect(getCompletedGameCount()).resolves.toBe(3);
    expect(getFirstAsync).toHaveBeenCalledWith("SELECT COUNT(*) AS count FROM completed_games");
  });
});
