import type { DailyTrack } from "@/domain/daily";
import type { Difficulty } from "@/domain/sudoku/types";

import { buildShareLink } from "@/domain/shareLink";
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
  /** Used to build a deep link back to this exact puzzle (non-daily games). */
  puzzleId: string;
  elapsedSeconds: number;
  mistakes: number;
  hintsUsed: number;
  /** When false, time is omitted from the share line (timer setting off). */
  showTimer?: boolean;
  /** When false, mistakes are omitted from the share line (mistake counter off). */
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
 *
 * The call-to-action is a Universal Link to the *exact same puzzle* (carrying
 * the sharer's time/mistakes as a target to beat), not a bare store link: an
 * installed recipient lands straight on the puzzle, and everyone else hits the
 * web landing page which routes them to the App Store. So every share doubles as
 * both a challenge and free download marketing.
 */
export function formatShareText(input: ShareResultInput): string {
  const {
    difficulty,
    puzzleId,
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

  const link = buildShareLink({
    kind: daily ? daily.kind : "puzzle",
    ref: daily ? daily.dateKey : puzzleId,
    difficulty: daily ? null : difficulty,
    timeSeconds: showTimer ? elapsedSeconds : null,
    mistakes: showMistakes ? mistakes : null,
  });
  // "Beat it" only makes sense when there's a visible stat to beat; otherwise
  // it's a plain invitation to play the same grid.
  const cta =
    showTimer || showMistakes
      ? "Think you can beat it? Tap to play the same puzzle:"
      : "Tap to play this exact puzzle:";

  return [lines.join("\n"), `${cta}\n${link}`].join("\n\n");
}
