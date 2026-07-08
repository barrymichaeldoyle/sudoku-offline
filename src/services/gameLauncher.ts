import type { DailyTrack } from "@/domain/daily";
import type { GameState, Puzzle } from "@/domain/sudoku/types";

import { startDailyProgress } from "@/data/repositories/dailyRepository";
import { createGame, type SharedDailyMeta } from "@/data/repositories/gameRepository";
import { track } from "@/services/analyticsService";
import { syncDailyReminderSchedule } from "@/services/notificationService";
import { getSettings } from "@/state/useSettingsStore";

export type LaunchPuzzleOptions = {
  /** When set, records the user's own daily/challenge progress (Home flow). */
  dailyTrack?: DailyTrack;
  /** When set, tags a shared-link one-off so labels and share text stay correct. */
  sharedDaily?: SharedDailyMeta;
};

/**
 * Shared "start a game" path used by Home and the completion screen. Loads a
 * puzzle, persists a new game, records daily/challenge progress when applicable,
 * and emits the start analytics. Returns the game (caller handles navigation),
 * or null when no puzzle was available.
 */
export async function launchPuzzle(
  loadPuzzle: () => Promise<Puzzle | null>,
  { dailyTrack, sharedDaily }: LaunchPuzzleOptions = {},
): Promise<GameState | null> {
  const puzzle = await loadPuzzle();
  if (!puzzle) {
    return null;
  }
  const game = await createGame(puzzle, sharedDaily);
  if (dailyTrack && puzzle.dateKey) {
    await startDailyProgress(puzzle.dateKey, dailyTrack, puzzle.id, game.id);
    void track("daily_started", { track: dailyTrack, difficulty: game.difficulty });
    if (dailyTrack === "daily") {
      // Today's daily is now in progress — keep the reminder pointed at the next
      // genuinely-unfinished day.
      void syncDailyReminderSchedule(getSettings());
    }
  }
  void track("puzzle_started", {
    difficulty: game.difficulty,
    daily: dailyTrack ?? sharedDaily?.track ?? null,
  });
  return game;
}
