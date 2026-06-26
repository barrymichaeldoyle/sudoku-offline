import { clsx } from "clsx";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useWindowDimensions } from "react-native";

import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { DAILY_TRACKS, type DailyTrack } from "@/domain/daily";
import { NEW_GAME_DIFFICULTIES, type Difficulty } from "@/domain/sudoku/types";
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

// The two daily tracks, shown as their own cards so normal and daily never blend.
const DAILY_TRACK_LABELS: Record<DailyTrack, string> = {
  daily: "Daily",
  challenge: "Challenge",
};

const DAILY_TRACK_NOTES: Record<DailyTrack, string> = {
  daily: "Medium · feeds your streak",
  challenge: "Extreme",
};

// Reuse the difficulty colour cue: the daily puzzle is medium, the challenge extreme.
const DAILY_TRACK_DOT: Record<DailyTrack, string> = {
  daily: DIFFICULTY_DOT.medium,
  challenge: DIFFICULTY_DOT.extreme,
};

const SECTION_LABEL_CLASS = "text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase";

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

  // Largest per-difficulty completion count, so the Normal bars are sized relatively.
  const maxCompleted = stats
    ? Math.max(1, ...NEW_GAME_DIFFICULTIES.map((d) => stats.normal.byDifficulty[d].completed))
    : 1;

  return (
    <Screen className="bg-canvas flex-1">
      <ScreenHeader title="Stats" onBack={() => router.back()} />

      {stats == null ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-soft">Loading…</Text>
        </View>
      ) : isStatsEmpty(stats) ? (
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
            className={clsx("w-full gap-8 self-center", large ? "max-w-[820px]" : "max-w-[640px]")}
          >
            {/* Normal Puzzles — ordinary play, kept apart from the daily tracks. */}
            <View className="gap-3">
              <Text className={SECTION_LABEL_CLASS}>Normal Puzzles</Text>

              {(() => {
                const completed = (
                  <StatCard
                    label="Completed"
                    value={String(stats.normal.totalCompleted)}
                    icon="🏆"
                  />
                );
                const mistakeFree =
                  settings.mistakeCheckingEnabled && stats.normal.totalCompleted > 0 ? (
                    <StatCard
                      label="Mistake-free"
                      value={String(stats.normal.mistakeFreeCompleted)}
                      icon="🎯"
                      hint={`${Math.round(
                        (stats.normal.mistakeFreeCompleted / stats.normal.totalCompleted) * 100,
                      )}% of completed`}
                    />
                  ) : null;
                const time = settings.timerEnabled ? (
                  <StatCard
                    label="Time played"
                    value={formatPlaytime(stats.normal.totalSeconds)}
                    icon="⏱️"
                  />
                ) : null;
                // Tablet: all the headline stats sit in one row across the width.
                return large ? (
                  <View className="flex-row gap-3">
                    {completed}
                    {mistakeFree}
                    {time}
                  </View>
                ) : (
                  <>
                    <View className="flex-row gap-3">
                      {completed}
                      {mistakeFree}
                    </View>
                    {time ? <View className="flex-row">{time}</View> : null}
                  </>
                );
              })()}

              <Text className={clsx(SECTION_LABEL_CLASS, "mt-1")}>By Difficulty</Text>
              {NEW_GAME_DIFFICULTIES.map((difficulty) => {
                const stat = stats.normal.byDifficulty[difficulty];
                return (
                  <StatRow
                    key={difficulty}
                    dot={DIFFICULTY_DOT[difficulty]}
                    label={DIFFICULTY_LABELS[difficulty]}
                    completed={stat.completed}
                    bestSeconds={stat.bestSeconds}
                    averageSeconds={stat.averageSeconds}
                    showTime={settings.timerEnabled}
                    barPct={Math.round((stat.completed / maxCompleted) * 100)}
                  />
                );
              })}
            </View>

            {/* Daily Puzzles — the streak plus each track on its own. */}
            <View className="gap-3">
              <Text className={SECTION_LABEL_CLASS}>Daily Puzzles</Text>
              <View className="flex-row gap-3">
                <StatCard
                  label="Current streak"
                  value={String(stats.daily.streak.current)}
                  icon="🔥"
                />
                <StatCard
                  label="Longest streak"
                  value={String(stats.daily.streak.longest)}
                  icon="🏅"
                />
              </View>
              {DAILY_TRACKS.map((track) => {
                const stat = stats.daily.byTrack[track];
                return (
                  <StatRow
                    key={track}
                    dot={DAILY_TRACK_DOT[track]}
                    label={DAILY_TRACK_LABELS[track]}
                    note={DAILY_TRACK_NOTES[track]}
                    completed={stat.completed}
                    bestSeconds={stat.bestSeconds}
                    averageSeconds={stat.averageSeconds}
                    showTime={settings.timerEnabled}
                  />
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

/** No play at all — neither a normal completion nor a completed daily on any track. */
function isStatsEmpty(stats: GameStats): boolean {
  return (
    stats.normal.totalCompleted === 0 &&
    DAILY_TRACKS.every((t) => stats.daily.byTrack[t].completed === 0)
  );
}

/**
 * A breakdown row used in both the Normal "By Difficulty" list and the Daily
 * track cards: a colour dot, a label (+ optional note), the completed count and
 * — when timing is on — best/avg times. Pass `barPct` to draw a relative
 * completion bar (the difficulty rows do; the daily track cards don't).
 */
function StatRow({
  dot,
  label,
  note,
  completed,
  bestSeconds,
  averageSeconds,
  showTime,
  barPct,
}: {
  dot: string;
  label: string;
  note?: string;
  completed: number;
  bestSeconds: number | null;
  averageSeconds: number | null;
  showTime: boolean;
  barPct?: number;
}) {
  const large = useWindowDimensions().width >= 700;
  const empty = completed === 0;
  return (
    <View
      className={clsx(
        "border-line bg-surface rounded-2xl border",
        large ? "gap-3 px-5 py-4" : "gap-2.5 px-4 py-3",
        empty && "opacity-50",
      )}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className={clsx("rounded-full", large ? "h-3 w-3" : "h-2.5 w-2.5", dot)} />
          <View>
            <Text className={clsx("text-ink font-medium", large ? "text-lg" : "text-base")}>
              {label}
            </Text>
            {note ? (
              <Text className={clsx("text-ink-soft", large ? "text-sm" : "text-xs")}>{note}</Text>
            ) : null}
          </View>
        </View>
        <View className="items-end">
          <Text className={clsx("text-ink tabular-nums", large ? "text-lg" : "text-base")}>
            {completed} done
          </Text>
          {showTime && bestSeconds != null ? (
            <Text className={clsx("text-ink-soft tabular-nums", large ? "text-base" : "text-sm")}>
              best {formatDuration(bestSeconds)} · avg {formatDuration(averageSeconds ?? 0)}
            </Text>
          ) : null}
        </View>
      </View>
      {/* Completion bar, sized relative to your most-played difficulty. */}
      {barPct != null ? (
        <View
          className={clsx("bg-surface-muted overflow-hidden rounded-full", large ? "h-2" : "h-1.5")}
        >
          <View className={clsx("h-full rounded-full", dot)} style={{ width: `${barPct}%` }} />
        </View>
      ) : null}
    </View>
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
  const large = useWindowDimensions().width >= 700;
  return (
    <View
      className={clsx(
        "border-line bg-surface flex-1 gap-1 rounded-2xl border",
        large ? "p-5" : "p-4",
      )}
    >
      <View className="flex-row items-center justify-between">
        <Text className={clsx("text-ink font-bold tabular-nums", large ? "text-4xl" : "text-3xl")}>
          {value}
        </Text>
        <Text className={large ? "text-2xl" : "text-xl"}>{icon ?? ""}</Text>
      </View>
      <Text className={clsx("text-ink-soft", large ? "text-base" : "text-sm")}>{label}</Text>
      {hint ? <Text className="text-ink-dim text-xs">{hint}</Text> : null}
    </View>
  );
}
