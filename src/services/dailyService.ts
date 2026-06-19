import type { DailyTrack } from "@/domain/daily";
import type { Puzzle } from "@/domain/sudoku/types";

import { getDailyPoolCount, getDailyPuzzleByIndex } from "@/data/repositories/puzzleRepository";

const MS_PER_DAY = 86_400_000;

/** Local calendar date key, e.g. "2026-06-18". */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole days between the Unix epoch and a "YYYY-MM-DD" key (UTC-based, stable). */
export function daysSinceEpoch(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Deterministic index into the daily pool for a given date. */
export function dailyIndexForDate(dateKey: string, poolCount: number): number {
  if (poolCount <= 0) {
    return 0;
  }
  return ((daysSinceEpoch(dateKey) % poolCount) + poolCount) % poolCount;
}

/**
 * The daily puzzle for a track and date, selected deterministically from that
 * track's bundled pool so it is identical on every device and works fully
 * offline. The "daily" track is the normal puzzle; "challenge" is the extreme one.
 */
export async function getDailyPuzzle(
  track: DailyTrack = "daily",
  dateKey: string = getLocalDateKey(),
): Promise<Puzzle | null> {
  const count = await getDailyPoolCount(track);
  if (count === 0) {
    return null;
  }
  return getDailyPuzzleByIndex(track, dailyIndexForDate(dateKey, count), dateKey);
}
