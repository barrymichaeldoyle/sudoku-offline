import type { DailyTrack } from "@/domain/daily";
import type { Difficulty } from "@/domain/sudoku/types";

import { formatDuration } from "@/domain/time";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  extreme: "Extreme",
};

export type ShareResultInput = {
  difficulty: Difficulty;
  elapsedSeconds: number;
  mistakes: number;
  hintsUsed: number;
  /** When false, time is omitted from the share line (timer setting off). */
  showTimer?: boolean;
  /** When false, mistakes are omitted from the share line (mistake checking off). */
  showMistakes?: boolean;
  /** Set when the completed game was a daily; `kind` picks the heading/streak. */
  daily?: { kind: DailyTrack; dateKey: string; streak: number } | null;
};

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Build the user-facing result text shared from the completion screen. Pure so
 * it can be unit-tested and reused by any share surface.
 */
export function formatShareText(input: ShareResultInput): string {
  const {
    difficulty,
    elapsedSeconds,
    mistakes,
    hintsUsed,
    showTimer = true,
    showMistakes = true,
    daily,
  } = input;

  let heading: string;
  if (daily?.kind === "challenge") {
    heading = `Sudoku Daily Challenge — ${daily.dateKey}`;
  } else if (daily) {
    heading = `Sudoku Daily — ${daily.dateKey}`;
  } else {
    heading = `Sudoku — ${DIFFICULTY_LABELS[difficulty]}`;
  }

  const statParts: string[] = [];
  if (showTimer) {
    statParts.push(`⏱ ${formatDuration(elapsedSeconds)}`);
  }
  if (showMistakes) {
    statParts.push(`❌ ${pluralize(mistakes, "mistake")}`);
  }
  statParts.push(`💡 ${pluralize(hintsUsed, "hint")}`);

  const lines = [heading, statParts.join(" · ")];
  // Only the normal daily has a streak.
  if (daily?.kind === "daily" && daily.streak > 0) {
    lines.push(`🔥 ${daily.streak} day streak`);
  }
  return lines.join("\n");
}
