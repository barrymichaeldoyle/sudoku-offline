import type { DailyTrack } from "@/domain/daily";

import { getCompletedDailyDateKeys, getDailyForGame } from "@/data/repositories/dailyRepository";
import {
  getCompletedGameStats,
  getDailyTrackStats,
  type CompletedGameStats,
  type DailyTrackStat,
} from "@/data/repositories/statsRepository";
import { computeStreak, type Streak } from "@/domain/streak";
import { getLocalDateKey } from "@/services/dailyService";

export type GameStats = {
  /** Ordinary (non-daily) play, broken down by pickable difficulty. */
  normal: CompletedGameStats;
  /** Daily play, kept separate from normal so the two never blend. */
  daily: {
    byTrack: Record<DailyTrack, DailyTrackStat>;
    /** Streak for the normal "daily" track (the challenge track has none). */
    streak: Streak;
  };
};

/** Everything the Stats screen needs: normal aggregates + per-track daily stats + streak. */
export async function getGameStats(): Promise<GameStats> {
  const [normal, byTrack, dailyKeys] = await Promise.all([
    getCompletedGameStats(),
    getDailyTrackStats(),
    getCompletedDailyDateKeys("daily"),
  ]);
  const streak = computeStreak(dailyKeys, getLocalDateKey());
  return { normal, daily: { byTrack, streak } };
}

export type DailyCompletionInfo = {
  dateKey: string;
  track: DailyTrack;
  /** Up-to-date streak for the normal daily track; null for the challenge track. */
  streak: Streak | null;
};

/**
 * For the completion screen: if `gameId` was a daily (either track), return its
 * date key, track, and — for the normal daily — the up-to-date streak so the
 * result can show the streak and a daily share. Returns null for ordinary games.
 */
export async function getDailyCompletionInfo(gameId: string): Promise<DailyCompletionInfo | null> {
  const daily = await getDailyForGame(gameId);
  if (!daily) {
    return null;
  }
  if (daily.track !== "daily") {
    return { dateKey: daily.dateKey, track: daily.track, streak: null };
  }
  const dailyKeys = await getCompletedDailyDateKeys("daily");
  return {
    dateKey: daily.dateKey,
    track: daily.track,
    streak: computeStreak(dailyKeys, getLocalDateKey()),
  };
}
