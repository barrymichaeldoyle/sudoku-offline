jest.mock("@/data/repositories/dailyRepository", () => ({
  getCompletedDailyDateKeys: jest.fn(),
  getDailyForGame: jest.fn(),
}));
jest.mock("@/services/dailyService", () => ({
  getLocalDateKey: jest.fn(() => "2026-07-05"),
}));

import { getCompletedDailyDateKeys, getDailyForGame } from "@/data/repositories/dailyRepository";

import { getDailyCompletionInfo } from "./statsService";

const mockGetDailyForGame = getDailyForGame as jest.Mock;
const mockGetCompletedDailyDateKeys = getCompletedDailyDateKeys as jest.Mock;

function dailyRecord(overrides: Record<string, unknown> = {}) {
  return {
    dateKey: "2026-07-05",
    track: "daily",
    puzzleId: "p1",
    gameId: "g1",
    completedAt: null,
    elapsedSeconds: null,
    mistakes: null,
    hintsUsed: null,
    ...overrides,
  };
}

describe("getDailyCompletionInfo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null for a non-daily game", async () => {
    mockGetDailyForGame.mockResolvedValue(null);
    expect(await getDailyCompletionInfo("g1")).toBeNull();
  });

  it("returns a null streak for the challenge track", async () => {
    mockGetDailyForGame.mockResolvedValue(dailyRecord({ track: "challenge" }));
    const info = await getDailyCompletionInfo("g1");
    expect(info).toEqual({ dateKey: "2026-07-05", track: "challenge", streak: null });
  });

  it("shows a 1-day streak on a first-ever completion even before the write lands", async () => {
    mockGetDailyForGame.mockResolvedValue(dailyRecord());
    // The async completion write hasn't stamped completed_at yet.
    mockGetCompletedDailyDateKeys.mockResolvedValue([]);
    const info = await getDailyCompletionInfo("g1");
    expect(info?.streak).toEqual({ current: 1, longest: 1 });
  });

  it("does not double-count today once the completion write has landed", async () => {
    mockGetDailyForGame.mockResolvedValue(dailyRecord());
    mockGetCompletedDailyDateKeys.mockResolvedValue(["2026-07-05"]);
    const info = await getDailyCompletionInfo("g1");
    expect(info?.streak).toEqual({ current: 1, longest: 1 });
  });

  it("extends yesterday's streak while today's write is still in flight", async () => {
    mockGetDailyForGame.mockResolvedValue(dailyRecord());
    mockGetCompletedDailyDateKeys.mockResolvedValue(["2026-07-03", "2026-07-04"]);
    const info = await getDailyCompletionInfo("g1");
    expect(info?.streak).toEqual({ current: 3, longest: 3 });
  });
});
