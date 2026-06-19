import type { DailyTrack } from "@/domain/daily";

import { getCompletedDailyDateKeys, getDailyForGame } from "@/data/repositories/dailyRepository";
import {
  getCompletedGameStats,
  type CompletedGameStats,
} from "@/data/repositories/statsRepository";
import { computeStreak, type Streak } from "@/domain/streak";
import { getLocalDateKey } from "@/services/dailyService";

export type GameStats = CompletedGameStats & {
  streak: Streak;
};

/** Everything the Stats screen needs: completed-game aggregates + daily streak. */
export async function getGameStats(): Promise<GameStats> {
  const [completed, dailyKeys] = await Promise.all([
    getCompletedGameStats(),
    getCompletedDailyDateKeys(),
  ]);
  const streak = computeStreak(dailyKeys, getLocalDateKey());
  return { ...completed, streak };
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
