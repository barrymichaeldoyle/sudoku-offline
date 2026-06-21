import { clsx } from "clsx";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useWindowDimensions } from "react-native";

import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { DIFFICULTIES, type Difficulty } from "@/domain/sudoku/types";
import { formatDuration } from "@/domain/time";
import { getGameStats, type GameStats } from "@/services/statsService";
import { useSettingsStore } from "@/state/useSettingsStore";
import { ScrollView, Text, View } from "@/tw";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  extreme: "Extreme",
};

// A calm colour cue per difficulty, mirroring the Home screen.
const DIFFICULTY_DOT: Record<Difficulty, string> = {
  easy: "bg-success",
  medium: "bg-accent",
  hard: "bg-warning",
  expert: "bg-danger",
  extreme: "bg-primary",
};

// Extreme isn't a pickable "New Game" difficulty — it's only reached via the
// Daily Challenge, so call that out in the breakdown.
const DIFFICULTY_NOTE: Partial<Record<Difficulty, string>> = {
  extreme: "Daily Challenge only",
};

export default function StatsScreen() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const [stats, setStats] = useState<GameStats | null>(null);
  // Wide screens (iPad) use a wider column and a single 4-across stat row so the
  // content fills the canvas instead of floating as a narrow strip.
  const large = useWindowDimensions().width >= 700;

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

  // Largest per-difficulty completion count, so the bars are sized relatively.
  const maxCompleted = stats
    ? Math.max(1, ...DIFFICULTIES.map((d) => stats.byDifficulty[d].completed))
    : 1;

  return (
    <Screen className="bg-canvas flex-1">
      <ScreenHeader title="Stats" onBack={() => router.back()} />

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
        <ScrollView className="flex-1" contentContainerClassName="grow justify-center p-6">
          <View
            className={clsx("w-full gap-6 self-center", large ? "max-w-[820px]" : "max-w-[640px]")}
          >
            {(() => {
              const completed = (
                <StatCard label="Completed" value={String(stats.totalCompleted)} icon="🏆" />
              );
              const mistakeFree = settings.mistakeCheckingEnabled ? (
                <StatCard
                  label="Mistake-free"
                  value={String(stats.mistakeFreeCompleted)}
                  icon="🎯"
                  hint={`${Math.round(
                    (stats.mistakeFreeCompleted / stats.totalCompleted) * 100,
                  )}% of completed`}
                />
              ) : null;
              const current = (
                <StatCard label="Current streak" value={String(stats.streak.current)} icon="🔥" />
              );
              const longest = (
                <StatCard label="Longest streak" value={String(stats.streak.longest)} icon="🏅" />
              );
              // Tablet: all the headline stats sit in one row across the width.
              return large ? (
                <View className="flex-row gap-3">
                  {completed}
                  {mistakeFree}
                  {current}
                  {longest}
                </View>
              ) : (
                <>
                  <View className="flex-row gap-3">
                    {completed}
                    {mistakeFree}
                  </View>
                  <View className="flex-row gap-3">
                    {current}
                    {longest}
                  </View>
                </>
              );
            })()}

            {settings.timerEnabled ? (
              <View className="flex-row">
                <StatCard
                  label="Time played"
                  value={formatPlaytime(stats.totalSeconds)}
                  icon="⏱️"
                />
              </View>
            ) : null}

            <View className="gap-3">
              <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
                By Difficulty
              </Text>
              {DIFFICULTIES.map((difficulty) => {
                const stat = stats.byDifficulty[difficulty];
                const empty = stat.completed === 0;
                const barPct = Math.round((stat.completed / maxCompleted) * 100);
                return (
                  <View
                    key={difficulty}
                    className={clsx(
                      "border-line bg-surface gap-2.5 rounded-2xl border px-4 py-3",
                      empty && "opacity-50",
                    )}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        <View
                          className={clsx("h-2.5 w-2.5 rounded-full", DIFFICULTY_DOT[difficulty])}
                        />
                        <View>
                          <Text className="text-ink text-base font-medium">
                            {DIFFICULTY_LABELS[difficulty]}
                          </Text>
                          {DIFFICULTY_NOTE[difficulty] ? (
                            <Text className="text-ink-soft text-xs">
                              {DIFFICULTY_NOTE[difficulty]}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="text-ink text-base tabular-nums">
                          {stat.completed} done
                        </Text>
                        {settings.timerEnabled && stat.bestSeconds != null ? (
                          <Text className="text-ink-soft text-sm tabular-nums">
                            best {formatDuration(stat.bestSeconds)} · avg{" "}
                            {formatDuration(stat.averageSeconds ?? 0)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {/* Completion bar, sized relative to your most-played difficulty. */}
                    <View className="bg-surface-muted h-1.5 overflow-hidden rounded-full">
                      <View
                        className={clsx("h-full rounded-full", DIFFICULTY_DOT[difficulty])}
                        style={{ width: `${barPct}%` }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

/** Human total playtime, e.g. "2h 14m" / "37m" / "< 1m". */
function formatPlaytime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "< 1m";
}

function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon?: string;
  hint?: string;
}) {
  return (
    <View className="border-line bg-surface flex-1 gap-1 rounded-2xl border p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-ink text-3xl font-bold tabular-nums">{value}</Text>
        {icon ? <Text className="text-xl">{icon}</Text> : null}
      </View>
      <Text className="text-ink-soft text-sm">{label}</Text>
      {hint ? <Text className="text-ink-dim text-xs">{hint}</Text> : null}
    </View>
  );
}
