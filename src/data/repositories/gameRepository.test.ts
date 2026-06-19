jest.mock("../db/client", () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from "../db/client";
import { getActiveGame } from "./gameRepository";

const mockGetDatabase = getDatabase as jest.Mock;

describe("gameRepository", () => {
  beforeEach(() => {
    mockGetDatabase.mockReset();
  });

  it("excludes daily and challenge games from the generic active game", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    mockGetDatabase.mockResolvedValue({ getFirstAsync });

    await expect(getActiveGame()).resolves.toBeNull();

    expect(getFirstAsync).toHaveBeenCalledWith(expect.stringContaining("id NOT IN"));
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("SELECT game_id FROM daily_progress"),
    );
  });
});
