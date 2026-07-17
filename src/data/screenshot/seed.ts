import { getDatabase, withWriteLock } from "@/data/db/client";
import { saveGame } from "@/data/repositories/gameRepository";
import { seedSampleStats } from "@/data/repositories/statsRepository";
import { CELL_COUNT, type CellValue, type GameState, type NoteMask } from "@/domain/sudoku/types";

/**
 * True only in builds made with `EXPO_PUBLIC_SCREENSHOT_MODE=1`. Gates the
 * hidden `/shots` deep-link route (see app/shots/[screen].tsx) so none of this
 * scaffolding is reachable in a normal release build.
 */
export const SCREENSHOT_MODE = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === "1";

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
}

async function wipeGames(): Promise<void> {
  await withWriteLock(async () => {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM games");
  });
}
