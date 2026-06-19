import type { DailyTrack } from "@/domain/daily";
import type { GameState, Puzzle } from "@/domain/sudoku/types";

import { startDailyProgress } from "@/data/repositories/dailyRepository";
import { createGame } from "@/data/repositories/gameRepository";
import { track } from "@/services/analyticsService";

/**
 * Shared "start a game" path used by Home and the completion screen. Loads a
 * puzzle, persists a new game, records daily/challenge progress when applicable,
 * and emits the start analytics. Returns the game (caller handles navigation),
 * or null when no puzzle was available.
 */
export async function launchPuzzle(
  loadPuzzle: () => Promise<Puzzle | null>,
  dailyTrack?: DailyTrack,
): Promise<GameState | null> {
  const puzzle = await loadPuzzle();
  if (!puzzle) {
    return null;
  }
  const game = await createGame(puzzle);
  if (dailyTrack && puzzle.dateKey) {
    await startDailyProgress(puzzle.dateKey, dailyTrack, puzzle.id, game.id);
    void track("daily_started", { track: dailyTrack, difficulty: game.difficulty });
  }
  void track("puzzle_started", { difficulty: game.difficulty, daily: dailyTrack ?? null });
  return game;
}
