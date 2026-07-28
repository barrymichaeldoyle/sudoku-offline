import type { RecentGame, RecentGameFilter } from "@/data/repositories/statsRepository";
import type { View as NativeView } from "react-native";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable as NativePressable,
  ScrollView as NativeScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
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
import { haptics } from "@/services/haptics";
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
  error?: boolean;
  onFilterChange: (filter: RecentGameFilter) => void;
  onShowMore: () => void;
  onRetry?: () => void;
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
const FILTER_MENU_MAX_HEIGHT = 360;
const SCREEN_EDGE_GAP = 12;

type FilterAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function focusForScreenReader(node: NativeView | null): void {
  if (node == null) {
    return;
  }

  void AccessibilityInfo.isScreenReaderEnabled()
    .then((enabled) => {
      if (!enabled) {
        return;
      }

      requestAnimationFrame(() => {
        const reactTag = findNodeHandle(node);
        if (reactTag != null) {
          AccessibilityInfo.setAccessibilityFocus(reactTag);
        }
      });
    })
    .catch(() => {});
}

export function RecentGamesSection({
  games,
  settings,
  filter,
  hasMore,
  loading,
  error = false,
  onFilterChange,
  onShowMore,
  onRetry,
  onOpen,
}: RecentGamesSectionProps) {
  const triggerRef = useRef<NativeView>(null);
  const optionRefs = useRef<Partial<Record<RecentGameFilter, NativeView | null>>>({});
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();
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

  const changeFilter = (nextFilter: RecentGameFilter) => {
    if (nextFilter === filter) {
      return;
    }

    haptics.toggle();
    onFilterChange(nextFilter);
  };

  const selectFilter = (nextFilter: RecentGameFilter) => {
    closeFilterMenu();
    changeFilter(nextFilter);
  };

  const menuWidth = Math.min(
    screenWidth - SCREEN_EDGE_GAP * 2,
    FILTER_MENU_WIDTH + Math.max(0, fontScale - 1) * 72,
  );
  const menuMaxHeight = Math.min(FILTER_MENU_MAX_HEIGHT, screenHeight - SCREEN_EDGE_GAP * 2);
  const menuLeft =
    filterAnchor == null
      ? SCREEN_EDGE_GAP
      : Math.min(
          screenWidth - menuWidth - SCREEN_EDGE_GAP,
          Math.max(SCREEN_EDGE_GAP, filterAnchor.x + filterAnchor.width - menuWidth),
        );
  const menuTop =
    filterAnchor == null
      ? SCREEN_EDGE_GAP
      : Math.min(
          screenHeight - menuMaxHeight - SCREEN_EDGE_GAP,
          filterAnchor.y + filterAnchor.height + 6,
        );

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-4 px-1">
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.5}
          className="text-ink-soft text-xs font-semibold tracking-widest uppercase"
        >
          Recent Games
        </Text>
        <View className="flex-row items-center gap-2">
          <Text maxFontSizeMultiplier={1.5} className="text-ink-soft text-sm">
            Filter
          </Text>
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
            <View className="border-line bg-surface-muted min-h-9 w-28 flex-row items-center justify-between rounded-xl border px-3 py-2">
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.5}
                className="text-ink text-sm font-semibold"
              >
                {selectedFilterLabel}
              </Text>
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
        onShow={() => focusForScreenReader(optionRefs.current[filter] ?? null)}
        onDismiss={() => focusForScreenReader(triggerRef.current)}
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
              width: menuWidth,
              maxHeight: menuMaxHeight,
              borderCurve: "continuous",
              boxShadow: "0 10px 30px rgba(28, 38, 56, 0.18)",
            }}
          >
            <NativeScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior="never"
            >
              {FILTERS.map((item, index) => {
                const selected = item.value === filter;
                return (
                  <NativePressable
                    ref={(node) => {
                      optionRefs.current[item.value] = node;
                    }}
                    key={item.value}
                    onPress={() => selectFilter(item.value)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
                  >
                    <View
                      className={clsx(
                        "min-h-11 flex-row items-center justify-between px-4 py-3",
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
            </NativeScrollView>
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
            <View className="border-line bg-surface items-center gap-2 rounded-2xl border px-4 py-5">
              <Text accessibilityLiveRegion="polite" className="text-ink-soft text-center">
                {loading
                  ? "Loading recent games…"
                  : error
                    ? "Couldn’t load recent games"
                    : `No ${filter === "all" ? "" : `${filter} `}games yet`}
              </Text>
              {!loading && error && onRetry ? (
                <Pressable
                  onPress={onRetry}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading recent games"
                  className="px-3 py-1 active:opacity-70"
                >
                  <Text className="text-primary text-base font-semibold">Retry</Text>
                </Pressable>
              ) : !loading && filter !== "all" ? (
                <Pressable
                  onPress={() => changeFilter("all")}
                  accessibilityRole="button"
                  accessibilityLabel="Show all recent games"
                  className="px-3 py-1 active:opacity-70"
                >
                  <Text className="text-primary text-base font-semibold">Show all games</Text>
                </Pressable>
              ) : null}
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
      {game.canReopen ? <SimpleIcon name="forward" tone="muted" size={20} /> : null}
    </Pressable>
  );
}
