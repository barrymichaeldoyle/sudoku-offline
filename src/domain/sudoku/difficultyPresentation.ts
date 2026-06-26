import type { DailyTrack } from "@/domain/daily";
import type { Difficulty } from "@/domain/sudoku/types";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  extreme: "Extreme",
};

/**
 * Colour cue per difficulty — an evenly-spaced hue ramp
 * (green → gold → orange → red → violet) so adjacent levels stay distinct even
 * at a tiny dot. Shared by Home and Stats so the cue means the same thing
 * everywhere. Always paired with the text label, never the sole indicator
 * (see docs/DESIGN_GUIDELINES.md §15.4). Tokens defined in global.css.
 */
export const DIFFICULTY_DOT: Record<Difficulty, string> = {
  easy: "bg-difficulty-easy",
  medium: "bg-difficulty-medium",
  hard: "bg-difficulty-hard",
  expert: "bg-difficulty-expert",
  extreme: "bg-difficulty-extreme",
};

/**
 * The two daily tracks borrow the colour of the difficulty they actually are —
 * the Daily Puzzle is a medium grid, the Daily Challenge an extreme one — so the
 * cue carries the same meaning as the New Game list rather than an arbitrary
 * accent.
 */
export const DAILY_TRACK_DIFFICULTY: Record<DailyTrack, Difficulty> = {
  daily: "medium",
  challenge: "extreme",
};

export const DAILY_TRACK_DOT: Record<DailyTrack, string> = {
  daily: DIFFICULTY_DOT[DAILY_TRACK_DIFFICULTY.daily],
  challenge: DIFFICULTY_DOT[DAILY_TRACK_DIFFICULTY.challenge],
};
