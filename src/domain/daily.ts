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
