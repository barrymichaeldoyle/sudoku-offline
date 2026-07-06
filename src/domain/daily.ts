/**
 * The two daily tracks. "daily" is the normal quick-win puzzle that drives the
 * streak; "challenge" is an optional extreme puzzle with no streak pressure.
 */
export type DailyTrack = "daily" | "challenge";

export const DAILY_TRACKS: readonly DailyTrack[] = ["daily", "challenge"];

/** SQLite id prefix for each track's bundled puzzle pool. */
export function trackIdPrefix(track: DailyTrack): string {
  return track === "challenge" ? "challenge_" : "daily_";
}

/** Infer a daily track from a bundled pool puzzle id, if applicable. */
export function inferDailyTrackFromPuzzleId(puzzleId: string): DailyTrack | null {
  if (puzzleId.startsWith(trackIdPrefix("challenge"))) {
    return "challenge";
  }
  if (puzzleId.startsWith(trackIdPrefix("daily"))) {
    return "daily";
  }
  return null;
}

/** Short value shown under the "Daily" stat label during play. */
export function dailyTrackStatValue(track: DailyTrack): string {
  return track === "challenge" ? "Challenge" : "Puzzle";
}

/** First segment of the completion summary line (replaces raw difficulty). */
export function dailyTrackSummaryLabel(track: DailyTrack): string {
  return track === "challenge" ? "Daily Challenge" : "Daily Puzzle";
}

/** Completion overlay heading for a finished daily track game. */
export function dailyTrackCompletionHeading(track: DailyTrack): string {
  return track === "challenge" ? "Daily Challenge Complete" : "Daily Puzzle Complete";
}
