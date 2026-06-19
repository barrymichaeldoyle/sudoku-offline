import { DIFFICULTIES, type Difficulty } from "@/domain/sudoku/types";

import { getDatabase } from "../db/client";

export type DifficultyStat = {
  completed: number;
  /** Fastest completion in seconds, or null if none. */
  bestSeconds: number | null;
  /** Mean completion time in seconds (rounded), or null if none. */
  averageSeconds: number | null;
};

export type CompletedGameStats = {
  totalCompleted: number;
  mistakeFreeCompleted: number;
  byDifficulty: Record<Difficulty, DifficultyStat>;
};

type AggregateRow = {
  difficulty: string;
  completed: number;
  best: number | null;
  avg: number | null;
  mistake_free: number;
};

function emptyByDifficulty(): Record<Difficulty, DifficultyStat> {
  return Object.fromEntries(
    DIFFICULTIES.map((d) => [d, { completed: 0, bestSeconds: null, averageSeconds: null }]),
  ) as Record<Difficulty, DifficultyStat>;
}

/** Aggregate completed-game stats straight from `completed_games`. */
export async function getCompletedGameStats(): Promise<CompletedGameStats> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AggregateRow>(
    `SELECT difficulty,
            COUNT(*) AS completed,
            MIN(elapsed_seconds) AS best,
            AVG(elapsed_seconds) AS avg,
            SUM(CASE WHEN mistakes = 0 THEN 1 ELSE 0 END) AS mistake_free
       FROM completed_games
      GROUP BY difficulty`,
  );

  const byDifficulty = emptyByDifficulty();
  let totalCompleted = 0;
  let mistakeFreeCompleted = 0;

  for (const row of rows) {
    totalCompleted += row.completed;
    mistakeFreeCompleted += row.mistake_free;
    if ((DIFFICULTIES as readonly string[]).includes(row.difficulty)) {
      byDifficulty[row.difficulty as Difficulty] = {
        completed: row.completed,
        bestSeconds: row.best,
        averageSeconds: row.avg == null ? null : Math.round(row.avg),
      };
    }
  }

  return { totalCompleted, mistakeFreeCompleted, byDifficulty };
}
