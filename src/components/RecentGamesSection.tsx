import type { RecentGame, RecentGameFilter } from "@/data/repositories/statsRepository";
import type { View as NativeView } from "react-native";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable as NativePressable, StyleSheet, useWindowDimensions } from "react-native";
import {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { SimpleIcon } from "@/components/SimpleIcon";
import { dailyTrackSummaryLabel } from "@/domain/daily";
import { formatHistoryDate } from "@/domain/history";
import { DIFFICULTY_DOT, DIFFICULTY_LABELS } from "@/domain/sudoku/difficultyPresentation";
import { formatDuration } from "@/domain/time";
import { Pressable, Text, View } from "@/tw";
import { Animated } from "@/tw/animated";

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

const ROW_ENTER = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const ROW_EXIT = FadeOut.duration(120).reduceMotion(ReduceMotion.System);
const ROW_LAYOUT = LinearTransition.duration(180).reduceMotion(ReduceMotion.System);
const FILTER_MENU_WIDTH = 184;
const FILTER_MENU_HEIGHT = FILTERS.length * 44 + 2;
const SCREEN_EDGE_GAP = 12;

type FilterAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  const triggerRef = useRef<NativeView>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState<FilterAnchor | null>(null);
  const contentOpacity = useSharedValue(1);
  const selectedFilterLabel =
    FILTERS.find((item) => item.value === filter)?.label ?? FILTERS[0].label;

  useEffect(() => {
    contentOpacity.value = withTiming(loading ? 0.55 : 1, {
      duration: loading ? 100 : 160,
      reduceMotion: ReduceMotion.System,
    });
  }, [contentOpacity, loading]);

  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  const openFilterMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      setFilterAnchor({ x, y, width, height });
      setFilterMenuOpen(true);
    });
  };

  const closeFilterMenu = () => {
    setFilterMenuOpen(false);
  };

  const selectFilter = (nextFilter: RecentGameFilter) => {
    closeFilterMenu();
    if (nextFilter !== filter) {
      onFilterChange(nextFilter);
    }
  };

  const menuLeft =
    filterAnchor == null
      ? SCREEN_EDGE_GAP
      : Math.min(
          screenWidth - FILTER_MENU_WIDTH - SCREEN_EDGE_GAP,
          Math.max(SCREEN_EDGE_GAP, filterAnchor.x + filterAnchor.width - FILTER_MENU_WIDTH),
        );
  const menuTop =
    filterAnchor == null
      ? SCREEN_EDGE_GAP
      : Math.min(
          screenHeight - FILTER_MENU_HEIGHT - SCREEN_EDGE_GAP,
          filterAnchor.y + filterAnchor.height + 6,
        );

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
          <NativePressable
            ref={triggerRef}
            onPress={openFilterMenu}
            accessibilityRole="button"
            accessibilityLabel={`Filter recent games, ${selectedFilterLabel} selected`}
            accessibilityHint="Opens the recent games filter menu"
            accessibilityState={{ expanded: filterMenuOpen }}
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
          >
            <View className="border-line bg-surface-muted h-9 w-28 flex-row items-center justify-between rounded-xl border px-3">
              <Text className="text-ink text-sm font-semibold">{selectedFilterLabel}</Text>
              <SimpleIcon name="down" tone="muted" size={16} />
            </View>
          </NativePressable>
        </View>
      </View>
      <Modal
        visible={filterMenuOpen && filterAnchor != null}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeFilterMenu}
      >
        <View style={StyleSheet.absoluteFill}>
          <NativePressable
            onPress={closeFilterMenu}
            accessible={false}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            accessibilityRole="menu"
            onAccessibilityEscape={closeFilterMenu}
            className="border-line bg-surface overflow-hidden rounded-2xl border"
            style={{
              position: "absolute",
              left: menuLeft,
              top: menuTop,
              width: FILTER_MENU_WIDTH,
              borderCurve: "continuous",
              boxShadow: "0 10px 30px rgba(28, 38, 56, 0.18)",
            }}
          >
            {FILTERS.map((item, index) => {
              const selected = item.value === filter;
              return (
                <NativePressable
                  key={item.value}
                  onPress={() => selectFilter(item.value)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
                >
                  <View
                    className={clsx(
                      "h-11 flex-row items-center justify-between px-4",
                      index > 0 && "border-line border-t",
                      selected && "bg-surface-muted",
                    )}
                  >
                    <Text
                      className={clsx(
                        "text-base",
                        selected ? "text-primary font-semibold" : "text-ink font-medium",
                      )}
                    >
                      {item.label}
                    </Text>
                    {selected ? <SimpleIcon name="check" tone="primary" size={17} /> : null}
                  </View>
                </NativePressable>
              );
            })}
          </View>
        </View>
      </Modal>
      <Animated.View
        style={contentStyle}
        layout={ROW_LAYOUT}
        accessibilityState={{ busy: loading }}
        className="gap-3"
      >
        {games.length > 0 ? (
          games.map((game) => (
            <Animated.View
              key={game.id}
              entering={ROW_ENTER}
              exiting={ROW_EXIT}
              layout={ROW_LAYOUT}
            >
              <RecentGameRow game={game} settings={settings} onPress={() => onOpen(game)} />
            </Animated.View>
          ))
        ) : (
          <Animated.View
            key={`empty-${filter}`}
            entering={ROW_ENTER}
            exiting={ROW_EXIT}
            layout={ROW_LAYOUT}
          >
            <View className="border-line bg-surface items-center rounded-2xl border px-4 py-5">
              <Text className="text-ink-soft text-center">
                {loading
                  ? "Loading recent games…"
                  : `No ${filter === "all" ? "" : `${filter} `}games yet`}
              </Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
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
