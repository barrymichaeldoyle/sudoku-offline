import type { RecentGame, RecentGameFilter } from "@/data/repositories/statsRepository";

import { Host, Picker } from "@expo/ui";
import { clsx } from "clsx";

import { dailyTrackSummaryLabel } from "@/domain/daily";
import { formatHistoryDate } from "@/domain/history";
import { DIFFICULTY_DOT, DIFFICULTY_LABELS } from "@/domain/sudoku/difficultyPresentation";
import { formatDuration } from "@/domain/time";
import { Pressable, Text, View } from "@/tw";

type RecentGamesSectionProps = {
  games: RecentGame[];
  settings: {
    timerEnabled: boolean;
    mistakeTrackingEnabled: boolean;
  };
  filter: RecentGameFilter;
  hasMore: boolean;
  loading: boolean;
  onFilterChange: (filter: RecentGameFilter) => void;
  onShowMore: () => void;
  onOpen: (game: RecentGame) => void;
};

const FILTERS: readonly { value: RecentGameFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "daily", label: "Daily" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "expert", label: "Expert" },
];

export function RecentGamesSection({
  games,
  settings,
  filter,
  hasMore,
  loading,
  onFilterChange,
  onShowMore,
  onOpen,
}: RecentGamesSectionProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-4 px-1">
        <Text
          accessibilityRole="header"
          className="text-ink-soft text-xs font-semibold tracking-widest uppercase"
        >
          Recent Games
        </Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-ink-soft text-sm">Filter</Text>
          <Host matchContents>
            <Picker<RecentGameFilter> selectedValue={filter} onValueChange={onFilterChange}>
              {FILTERS.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </Host>
        </View>
      </View>
      {games.length > 0 ? (
        <View className="gap-3">
          {games.map((game) => (
            <RecentGameRow
              key={game.id}
              game={game}
              settings={settings}
              onPress={() => onOpen(game)}
            />
          ))}
        </View>
      ) : (
        <View className="border-line bg-surface items-center rounded-2xl border px-4 py-5">
          <Text className="text-ink-soft text-center">
            {loading
              ? "Loading recent games…"
              : `No ${filter === "all" ? "" : `${filter} `}games yet`}
          </Text>
        </View>
      )}
      {hasMore ? (
        <Pressable
          onPress={onShowMore}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Show 10 more recent games"
          className={clsx(
            "border-line bg-surface items-center rounded-2xl border px-4 py-3 active:opacity-70",
            loading && "opacity-50",
          )}
        >
          <Text className="text-primary text-base font-semibold">
            {loading ? "Loading…" : "Show 10 more"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RecentGameRow({
  game,
  settings,
  onPress,
}: {
  game: RecentGame;
  settings: RecentGamesSectionProps["settings"];
  onPress: () => void;
}) {
  const title = game.dailyTrack
    ? dailyTrackSummaryLabel(game.dailyTrack)
    : DIFFICULTY_LABELS[game.difficulty];
  const details = [
    game.dateKey
      ? formatHistoryDate(`${game.dateKey}T12:00:00`)
      : formatHistoryDate(game.completedAt),
  ];
  if (settings.timerEnabled) {
    details.push(formatDuration(game.elapsedSeconds));
  }
  if (settings.mistakeTrackingEnabled) {
    details.push(`${game.mistakes} ${game.mistakes === 1 ? "mistake" : "mistakes"}`);
  }
  details.push(`${game.hintsUsed} ${game.hintsUsed === 1 ? "hint" : "hints"}`);

  return (
    <Pressable
      onPress={onPress}
      disabled={!game.canReopen}
      accessibilityRole="button"
      accessibilityState={{ disabled: !game.canReopen }}
      accessibilityLabel={`${title}, ${details.join(", ")}${
        game.canReopen ? ", view solved board" : ", summary only"
      }`}
      className={clsx(
        "border-line bg-surface flex-row items-center gap-3 rounded-2xl border px-4 py-3",
        game.canReopen ? "active:opacity-70" : "opacity-60",
      )}
    >
      <View className={clsx("h-2.5 w-2.5 rounded-full", DIFFICULTY_DOT[game.difficulty])} />
      <View className="flex-1 gap-0.5">
        <Text className="text-ink text-base font-medium">{title}</Text>
        <Text className="text-ink-soft text-sm tabular-nums">{details.join(" · ")}</Text>
        {game.canReopen ? null : (
          <Text className="text-ink-dim text-xs">Previous run · summary only</Text>
        )}
      </View>
      {game.canReopen ? <Text className="text-ink-soft text-xl">›</Text> : null}
    </Pressable>
  );
}
