import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { Screen } from "@/components/Screen";
import { DIFFICULTIES, type Difficulty } from "@/domain/sudoku/types";
import { formatDuration } from "@/domain/time";
import { getGameStats, type GameStats } from "@/services/statsService";
import { useSettingsStore } from "@/state/useSettingsStore";
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
  const settings = useSettingsStore((s) => s.settings);
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
    <Screen className="bg-canvas flex-1">
      <View className="flex-row items-center px-4 pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          className="py-1 pr-4 active:opacity-60"
        >
          <Text className="text-primary text-base font-medium">‹ Home</Text>
        </Pressable>
        <Text className="text-ink text-lg font-semibold">Stats</Text>
      </View>

      {stats == null ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-soft">Loading…</Text>
        </View>
      ) : stats.totalCompleted === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 p-8">
          <Text className="text-ink text-center text-lg font-medium">No completed puzzles yet</Text>
          <Text className="text-ink-soft text-center">
            {settings.timerEnabled
              ? "Finish a puzzle to start tracking your times and streak."
              : "Finish a puzzle to start building your streak."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-6 p-6">
          <View className="flex-row gap-3">
            <StatCard label="Completed" value={String(stats.totalCompleted)} />
            {settings.mistakeCheckingEnabled ? (
              <StatCard label="Mistake-free" value={String(stats.mistakeFreeCompleted)} />
            ) : null}
          </View>

          <View className="flex-row gap-3">
            <StatCard label="Current streak" value={`${stats.streak.current} 🔥`} />
            <StatCard label="Longest streak" value={String(stats.streak.longest)} />
          </View>

          <View className="gap-3">
            <Text className="text-ink-dim px-1 text-xs font-semibold tracking-widest uppercase">
              By Difficulty
            </Text>
            {DIFFICULTIES.map((difficulty) => {
              const stat = stats.byDifficulty[difficulty];
              return (
                <View
                  key={difficulty}
                  className="border-line bg-surface flex-row items-center justify-between rounded-2xl border px-4 py-3"
                >
                  <Text className="text-ink text-base font-medium">
                    {DIFFICULTY_LABELS[difficulty]}
                  </Text>
                  <View className="items-end">
                    <Text className="text-ink text-base tabular-nums">{stat.completed} done</Text>
                    {settings.timerEnabled ? (
                      <Text className="text-ink-soft text-sm tabular-nums">
                        {stat.bestSeconds == null
                          ? "—"
                          : `best ${formatDuration(stat.bestSeconds)} · avg ${formatDuration(
                              stat.averageSeconds ?? 0,
                            )}`}
                      </Text>
                    ) : null}
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
    <View className="border-line bg-surface flex-1 gap-1 rounded-2xl border p-4">
      <Text className="text-ink text-3xl font-bold tabular-nums">{value}</Text>
      <Text className="text-ink-soft text-sm">{label}</Text>
    </View>
  );
}
