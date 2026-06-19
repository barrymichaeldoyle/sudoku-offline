import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { Screen } from "@/components/Screen";
import { DIFFICULTIES, type Difficulty } from "@/domain/sudoku/types";
import { formatDuration } from "@/domain/time";
import { getGameStats, type GameStats } from "@/services/statsService";
import { Pressable, ScrollView, Text, View } from "@/tw";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  extreme: "Extreme",
};

export default function StatsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<GameStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getGameStats().then((s) => {
        if (!cancelled) setStats(s);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <Screen className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-row items-center px-4 pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          className="py-1 pr-4"
        >
          <Text className="text-base text-blue-600 dark:text-blue-400">‹ Home</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Stats</Text>
      </View>

      {stats == null ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-500">Loading…</Text>
        </View>
      ) : stats.totalCompleted === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 p-8">
          <Text className="text-center text-lg font-medium text-neutral-900 dark:text-neutral-100">
            No completed puzzles yet
          </Text>
          <Text className="text-center text-neutral-500">
            Finish a puzzle to start tracking your times and streak.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-6 p-6">
          <View className="flex-row gap-3">
            <StatCard label="Completed" value={String(stats.totalCompleted)} />
            <StatCard label="Mistake-free" value={String(stats.mistakeFreeCompleted)} />
          </View>

          <View className="flex-row gap-3">
            <StatCard label="Current streak" value={`${stats.streak.current} 🔥`} />
            <StatCard label="Longest streak" value={String(stats.streak.longest)} />
          </View>

          <View className="gap-3">
            <Text className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
              By Difficulty
            </Text>
            {DIFFICULTIES.map((difficulty) => {
              const stat = stats.byDifficulty[difficulty];
              return (
                <View
                  key={difficulty}
                  className="flex-row items-center justify-between rounded-xl bg-neutral-100 px-4 py-3 dark:bg-neutral-800"
                >
                  <Text className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                    {DIFFICULTY_LABELS[difficulty]}
                  </Text>
                  <View className="items-end">
                    <Text className="text-base text-neutral-900 tabular-nums dark:text-neutral-100">
                      {stat.completed} done
                    </Text>
                    <Text className="text-sm text-neutral-500 tabular-nums">
                      {stat.bestSeconds == null
                        ? "—"
                        : `best ${formatDuration(stat.bestSeconds)} · avg ${formatDuration(
                            stat.averageSeconds ?? 0,
                          )}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-1 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800">
      <Text className="text-2xl font-bold text-neutral-900 tabular-nums dark:text-neutral-50">
        {value}
      </Text>
      <Text className="text-sm text-neutral-500">{label}</Text>
    </View>
  );
}
