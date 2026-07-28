import { getDatabase, withWriteLock } from "@/data/db/client";
import { saveGame } from "@/data/repositories/gameRepository";
import { seedSampleStats } from "@/data/repositories/statsRepository";
import { findHintCell, type Hint } from "@/domain/sudoku/hints";
import { CELL_COUNT, type CellValue, type GameState, type NoteMask } from "@/domain/sudoku/types";

export const SCREENSHOT_GAME_ID = "screenshot-game";

// A full, valid solution. The puzzle (givens) and the player's in-progress
// board are both derived from it, so the seeded board can never contain a
// conflict: every filled cell matches the solution by construction.
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

// Cells with no clue (everything else is a given). A scattered medium layout.
const BLANKS = new Set([
  1, 3, 5, 6, 8, 9, 11, 13, 15, 17, 19, 21, 22, 24, 26, 27, 29, 32, 34, 37, 38, 40, 42, 43, 46, 48,
  51, 53, 54, 56, 58, 61, 63, 66, 68, 69, 73, 75, 77, 79,
]);

// Of those blanks, the ones the player has already filled in correctly (shown
// as user entries). Includes cell 40, the center, which the capture script
// selects to show peer + same-number highlighting.
const FILLED = new Set([1, 13, 19, 22, 29, 38, 40, 48, 56, 66, 73]);

/** The center cell the screenshot route pre-selects on the game screen. */
export const SCREENSHOT_SELECTED_CELL = 40;

// One cell of pencil notes (2, 3, 4) for a realistic in-progress board.
const NOTE_CELL = 42;
const NOTE_MASK: NoteMask = (1 << 1) | (1 << 2) | (1 << 3); // digits 2, 3, 4

/** The fixed in-progress game shown on the Continue card and the game screen. */
export function buildScreenshotGame(): GameState {
  const now = new Date().toISOString();
  let givens = "";
  const values: CellValue[] = [];
  const notes: NoteMask[] = Array.from({ length: CELL_COUNT }, () => 0);
  for (let i = 0; i < CELL_COUNT; i++) {
    const isClue = !BLANKS.has(i);
    givens += isClue ? SOLUTION[i] : "0";
    values.push(isClue || FILLED.has(i) ? Number(SOLUTION[i]) : null);
  }
  notes[NOTE_CELL] = NOTE_MASK;
  return {
    id: SCREENSHOT_GAME_ID,
    puzzleId: "screenshot-puzzle",
    difficulty: "medium",
    givens,
    solution: SOLUTION,
    values,
    notes,
    status: "active",
    elapsedSeconds: 272, // renders as 04:32
    mistakes: 0,
    hintsUsed: 0,
    hintedCells: [],
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  };
}

export type ScreenshotHintState = {
  game: GameState;
  hint: Hint;
};

/** The game state shown behind the explanatory-hint marketing screenshot. */
export function buildScreenshotHintState(): ScreenshotHintState {
  const game = buildScreenshotGame();
  const hint = findHintCell(game.values, game.givens, game.solution);
  if (!hint) {
    throw new Error("Screenshot game must contain a revealable hint cell");
  }
  const values = game.values.slice();
  values[hint.index] = hint.value;
  return {
    hint,
    game: {
      ...game,
      values,
      hintsUsed: 1,
      hintedCells: [hint.index],
    },
  };
}

// The second in-progress game, so the home shot shows the per-difficulty
// continue rows doing their job (Medium and Expert both resumable). Only its
// home-row summary is ever visible — the capture never opens this board — so
// the blank layout is a simple prefix split chosen for the counts alone:
// 26 of 48 blanks filled reads as 54%.
const EXPERT_BLANK_COUNT = 48;
const EXPERT_FILLED_COUNT = 26;

function buildScreenshotExpertGame(): GameState {
  const now = new Date().toISOString();
  let givens = "";
  const values: CellValue[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const isBlank = i < EXPERT_BLANK_COUNT;
    givens += isBlank ? "0" : SOLUTION[i];
    values.push(!isBlank || i < EXPERT_FILLED_COUNT ? Number(SOLUTION[i]) : null);
  }
  return {
    id: "screenshot-game-expert",
    puzzleId: "screenshot-puzzle-expert",
    difficulty: "expert",
    givens,
    solution: SOLUTION,
    values,
    notes: Array.from({ length: CELL_COUNT }, () => 0),
    status: "active",
    elapsedSeconds: 1141, // renders as 19:01
    mistakes: 0,
    hintsUsed: 0,
    hintedCells: [],
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  };
}

function buildScreenshotCompletedGame({
  id,
  difficulty,
  elapsedSeconds,
  mistakes,
  hintsUsed,
}: Pick<GameState, "id" | "difficulty" | "elapsedSeconds" | "mistakes" | "hintsUsed">): GameState {
  const now = new Date();
  return {
    id,
    puzzleId: `${id}-puzzle`,
    difficulty,
    givens: buildScreenshotGame().givens,
    solution: SOLUTION,
    values: SOLUTION.split("").map(Number),
    notes: Array.from({ length: CELL_COUNT }, () => 0),
    status: "active",
    elapsedSeconds,
    mistakes,
    hintsUsed,
    hintedCells: hintsUsed > 0 ? [1] : [],
    startedAt: new Date(now.getTime() - elapsedSeconds * 1000).toISOString(),
    completedAt: null,
    updatedAt: now.toISOString(),
  };
}

const SCREENSHOT_HISTORY_GAMES: GameState[] = [
  buildScreenshotCompletedGame({
    id: "screenshot-history-hard",
    difficulty: "hard",
    elapsedSeconds: 612,
    mistakes: 0,
    hintsUsed: 1,
  }),
  buildScreenshotCompletedGame({
    id: "screenshot-history-easy",
    difficulty: "easy",
    elapsedSeconds: 238,
    mistakes: 0,
    hintsUsed: 0,
  }),
  buildScreenshotCompletedGame({
    id: "screenshot-history-expert",
    difficulty: "expert",
    elapsedSeconds: 1084,
    mistakes: 2,
    hintsUsed: 2,
  }),
];

/**
 * Retry a DB write that loses a race with another in-flight statement. Arriving
 * via deep link, the seed's `BEGIN EXCLUSIVE` can collide with the home screen's
 * focus-effect reads and throw "database is locked"; the exclusive transaction
 * is atomic (it rolls back), so retrying the whole write is safe.
 */
async function withLockRetry<T>(fn: () => Promise<T>, attempts = 12, delayMs = 150): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const locked = err instanceof Error && /database is locked/i.test(err.message);
    if (!locked || attempts <= 1) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return withLockRetry(fn, attempts - 1, delayMs);
  }
}

async function seedScreenshotHistory(): Promise<void> {
  await Promise.all(SCREENSHOT_HISTORY_GAMES.map((game) => saveGame(game)));
  const now = Date.now();
  await withWriteLock(async () => {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Keep the three retained boards at the top of the history screenshot.
      // The larger stats fixture remains available below them for aggregates.
      await txn.runAsync(
        `UPDATE completed_games
            SET completed_at = ?
          WHERE id LIKE 'dev-%'`,
        new Date(now - 30 * 86_400_000).toISOString(),
      );
      await Promise.all(
        SCREENSHOT_HISTORY_GAMES.flatMap((game, index) => {
          const completedAt = new Date(now - index * 86_400_000).toISOString();
          return [
            txn.runAsync(
              `UPDATE games
                  SET status = 'completed', completed_at = ?, updated_at = ?
                WHERE id = ?`,
              completedAt,
              completedAt,
              game.id,
            ),
            txn.runAsync(
              `INSERT OR REPLACE INTO completed_games
               (id, game_id, puzzle_id, difficulty, date_key, elapsed_seconds, mistakes, hints_used, completed_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
              `${game.id}-completion`,
              game.id,
              game.puzzleId,
              game.difficulty,
              game.elapsedSeconds,
              game.mistakes,
              game.hintsUsed,
              completedAt,
            ),
          ];
        }),
      );
    });
  });
}

/**
 * Put the app into a fixed, photogenic state for store screenshots: seeded
 * stats + a 7-day streak + both dailies solved (via seedSampleStats), plus a
 * known in-progress game for the Continue card and the game screen. Fully
 * deterministic, so every capture run (and every locale) looks identical.
 */
export async function seedScreenshotData(): Promise<void> {
  // Start from an empty games table so leftover dev games can't leak into the
  // shots — and so a previously abandoned copy of a seed game can't block its
  // re-insert (saveGame's guard refuses to revive terminal rows).
  await withLockRetry(() => wipeGames());
  await withLockRetry(() => seedSampleStats());
  await withLockRetry(() => saveGame(buildScreenshotGame()));
  await withLockRetry(() => saveGame(buildScreenshotExpertGame()));
  await withLockRetry(() => seedScreenshotHistory());
}

async function wipeGames(): Promise<void> {
  await withWriteLock(async () => {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM games");
  });
}
