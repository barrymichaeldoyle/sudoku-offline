import type { DailyTrack } from "@/domain/daily";

import { clsx } from "clsx";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, useWindowDimensions } from "react-native";

import { AppMark } from "@/components/AppMark";
import { Screen } from "@/components/Screen";
import { SimpleIcon } from "@/components/SimpleIcon";
import { getCompletedDailyDateKeys, getDailyProgress } from "@/data/repositories/dailyRepository";
import {
  abandonGame,
  getGameById,
  getResumableGamesByDifficulty,
} from "@/data/repositories/gameRepository";
import { getRandomPuzzleByDifficulty } from "@/data/repositories/puzzleRepository";
import { computeStreak } from "@/domain/streak";
import { completionPercent } from "@/domain/sudoku/board";
import {
  DAILY_TRACK_DOT,
  DIFFICULTY_DOT,
  DIFFICULTY_LABELS,
} from "@/domain/sudoku/difficultyPresentation";
import {
  NEW_GAME_DIFFICULTIES,
  type Difficulty,
  type GameState,
  type Puzzle,
} from "@/domain/sudoku/types";
import { formatDuration } from "@/domain/time";
import { track } from "@/services/analyticsService";
import { getDailyPuzzle, getLocalDateKey } from "@/services/dailyService";
import { launchPuzzle } from "@/services/gameLauncher";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, ScrollView, Text, View } from "@/tw";

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: "Relaxed solving",
  medium: "A steady challenge",
  hard: "For regular players",
  expert: "Few givens, real focus",
  extreme: "The toughest grids",
};

type DailyCardState = {
  game: GameState | null;
  completed: boolean;
};

export default function Home() {
  const router = useRouter();
  // Short screens (e.g. iPhone SE, 667pt) tighten spacing so the home screen
  // fits without scrolling; taller phones keep the roomier layout. Wide screens
  // (iPad, ≥700pt) scale the brand mark and title up so they don't look small
  // inside the centered column.
  const { width, height } = useWindowDimensions();
  const compact = height < 720;
  const large = width >= 700;
  // `daily=1` arrives from a daily-reminder notification tap (see
  // notificationService); it means "take me to today's Daily Puzzle".
  const params = useLocalSearchParams<{ daily?: string }>();
  const setGame = useGameStore((s) => s.setGame);
  const settings = useSettingsStore((s) => s.settings);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const [resumables, setResumables] = useState<Partial<Record<Difficulty, GameState>>>({});
  const [dailyCards, setDailyCards] = useState<Record<DailyTrack, DailyCardState>>({
    daily: { game: null, completed: false },
    challenge: { game: null, completed: false },
  });
  const [streak, setStreak] = useState(0);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadHome = async () => {
        const [byDifficulty, daily, challenge, dailyKeys] = await Promise.all([
          getResumableGamesByDifficulty(),
          loadDailyCard("daily"),
          loadDailyCard("challenge"),
          getCompletedDailyDateKeys("daily"),
        ]);
        if (!cancelled) {
          setResumables(byDifficulty);
          setDailyCards({ daily, challenge });
          setStreak(computeStreak(dailyKeys, getLocalDateKey()).current);
        }
      };
      void loadHome();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const openGame = useCallback(
    (game: GameState) => {
      setGame(game);
      router.push({ pathname: "/game/[gameId]", params: { gameId: game.id } });
    },
    [router, setGame],
  );

  const startFromPuzzle = useCallback(
    async (
      loadPuzzle: () => Promise<Puzzle | null>,
      dailyTrack?: DailyTrack,
      existingGame?: GameState | null,
    ) => {
      if (busy) return;
      if (
        existingGame &&
        existingGame.status !== "completed" &&
        existingGame.status !== "abandoned"
      ) {
        openGame(existingGame);
        return;
      }
      setBusy(true);
      try {
        const game = await launchPuzzle(loadPuzzle, { dailyTrack });
        if (game) {
          openGame(game);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, openGame],
  );

  // Start a fresh (non-daily) game of the given difficulty. If that difficulty
  // already has a game in progress, confirm first and abandon it (which never
  // touches stats). Other difficulties' games are untouched.
  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const existing = resumables[difficulty];
      const start = async () => {
        if (busy) return;
        setBusy(true);
        try {
          if (existing) {
            await abandonGame(existing.id);
            void track("puzzle_abandoned", { difficulty: existing.difficulty });
          }
          const game = await launchPuzzle(() => getRandomPuzzleByDifficulty(difficulty));
          if (game) {
            openGame(game);
          }
        } finally {
          setBusy(false);
        }
      };
      if (existing) {
        Alert.alert(
          "Start a new game?",
          `Your current ${DIFFICULTY_LABELS[difficulty]} game will be abandoned. This won't affect your stats.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Start new", style: "destructive", onPress: () => void start() },
          ],
        );
        return;
      }
      void start();
    },
    [resumables, busy, openGame],
  );

  // Row tap: resume that difficulty's game in progress, or start a fresh one.
  const pressDifficulty = useCallback(
    (difficulty: Difficulty) => {
      const existing = resumables[difficulty];
      if (existing) {
        openGame(existing);
      } else {
        startNewGame(difficulty);
      }
    },
    [resumables, openGame, startNewGame],
  );

  // Reminder tap deep link: resume (or start) today's daily, then drop the
  // param so it fires once. Loads progress fresh so an in-progress daily resumes
  // rather than getting replaced by a new game.
  const dailyLinkHandled = useRef(false);
  useEffect(() => {
    if (params.daily !== "1" || !hydrated || !onboardingComplete || dailyLinkHandled.current) {
      return;
    }
    dailyLinkHandled.current = true;
    router.setParams({ daily: undefined });
    void (async () => {
      const card = await loadDailyCard("daily");
      if (card.completed) {
        return; // Already done today — just land on Home.
      }
      await startFromPuzzle(() => getDailyPuzzle("daily"), "daily", card.game);
    })();
  }, [params.daily, hydrated, onboardingComplete, router, startFromPuzzle]);

  // First launch: send the player to the minimal-vs-full setup screen.
  if (hydrated && !onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Screen className="bg-canvas flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName={clsx(
          "grow justify-center px-5",
          compact ? "pt-3 pb-4" : "pt-4 pb-6",
        )}
      >
        <View
          className={clsx(
            "w-full self-center",
            large ? "max-w-[820px]" : "max-w-[640px]",
            compact ? "gap-3" : large ? "gap-7" : "gap-5",
          )}
        >
          <View className={clsx("items-center", compact ? "gap-2" : large ? "gap-4" : "gap-3")}>
            <AppMark size={compact ? "sm" : large ? "lg" : "md"} />
            <View className="items-center gap-1">
              <Text
                className={clsx(
                  "text-ink text-center font-bold tracking-tight",
                  compact ? "text-3xl" : large ? "text-5xl" : "text-4xl",
                )}
              >
                Sudoku
              </Text>
              <Text
                className={clsx(
                  "text-ink-soft text-center font-medium",
                  large ? "text-lg" : "text-sm",
                )}
              >
                Classic puzzles · Works offline
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <DailyCard
              track="daily"
              title="Daily Puzzle"
              subtitle="Today's puzzle"
              progress={dailyCards.daily}
              streak={streak}
              settings={settings}
              onPress={() =>
                dailyCards.daily.completed && dailyCards.daily.game
                  ? openGame(dailyCards.daily.game)
                  : startFromPuzzle(() => getDailyPuzzle("daily"), "daily", dailyCards.daily.game)
              }
            />
            <DailyCard
              track="challenge"
              title="Daily Challenge"
              subtitle="A tougher grid"
              progress={dailyCards.challenge}
              settings={settings}
              onPress={() =>
                dailyCards.challenge.completed && dailyCards.challenge.game
                  ? openGame(dailyCards.challenge.game)
                  : startFromPuzzle(
                      () => getDailyPuzzle("challenge"),
                      "challenge",
                      dailyCards.challenge.game,
                    )
              }
            />
          </View>

          <View className="gap-3">
            <SectionLabel>Puzzles</SectionLabel>
            {large ? (
              // Tablet: a 2x2 card grid that fills the wider canvas, instead of
              // a thin single-column list floating in the middle.
              <View className="flex-row flex-wrap gap-3">
                {NEW_GAME_DIFFICULTIES.map((difficulty) => (
                  <DifficultyRow
                    key={difficulty}
                    difficulty={difficulty}
                    game={resumables[difficulty] ?? null}
                    settings={settings}
                    large
                    onPress={() => pressDifficulty(difficulty)}
                    onNewGame={() => startNewGame(difficulty)}
                  />
                ))}
              </View>
            ) : (
              <View className="border-line bg-surface overflow-hidden rounded-2xl border">
                {NEW_GAME_DIFFICULTIES.map((difficulty, i) => (
                  <DifficultyRow
                    key={difficulty}
                    difficulty={difficulty}
                    game={resumables[difficulty] ?? null}
                    settings={settings}
                    compact={compact}
                    divider={i > 0}
                    onPress={() => pressDifficulty(difficulty)}
                    onNewGame={() => startNewGame(difficulty)}
                  />
                ))}
              </View>
            )}
          </View>

          <View className="flex-row gap-3">
            <MiniButton label="Stats" icon="stats" onPress={() => router.push("/stats")} />
            <MiniButton label="Settings" icon="settings" onPress={() => router.push("/settings")} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

async function loadDailyCard(track: DailyTrack): Promise<DailyCardState> {
  const progress = await getDailyProgress(getLocalDateKey(), track);
  const game = progress?.gameId ? await getGameById(progress.gameId) : null;
  return { game, completed: progress?.completedAt != null };
}

/**
 * One entry in the Puzzles list: starts a fresh game of its difficulty, or —
 * when that difficulty has a game in progress — resumes it, showing the run's
 * progress and offering a small "New" action to deliberately start over. One
 * slot per difficulty, so switching between an Easy and an Expert solve never
 * loses either.
 */
function DifficultyRow({
  difficulty,
  game,
  settings,
  large = false,
  compact = false,
  divider = false,
  onPress,
  onNewGame,
}: {
  difficulty: Difficulty;
  game: GameState | null;
  settings: { timerEnabled: boolean; mistakeTrackingEnabled: boolean };
  large?: boolean;
  compact?: boolean;
  divider?: boolean;
  onPress: () => void;
  onNewGame: () => void;
}) {
  const label = DIFFICULTY_LABELS[difficulty];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        game
          ? `${label}, resume game, ${completionPercent(game.values, game.givens)} percent complete`
          : label
      }
      // The row is one accessibility element, which hides the nested New
      // pressable from screen readers; expose it as a custom action instead.
      accessibilityActions={
        game ? [{ name: "newGame", label: `Start a new ${label} game` }] : undefined
      }
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "newGame") {
          onNewGame();
        }
      }}
      style={large ? { width: "48.5%" } : undefined}
      className={clsx(
        "flex-row items-center gap-3 active:opacity-70",
        large
          ? "border-line bg-surface grow rounded-2xl border px-5 py-5"
          : ["px-5", compact ? "py-3" : "py-4", divider && "border-line border-t"],
      )}
    >
      <View
        className={clsx(
          "rounded-full",
          large ? "h-3 w-3" : "h-2.5 w-2.5",
          DIFFICULTY_DOT[difficulty],
        )}
      />
      <View className="flex-1 gap-1">
        <Text className={clsx("text-ink font-semibold", large ? "text-lg" : "text-base")}>
          {label}
        </Text>
        <Text className="text-ink-soft text-sm">
          {game ? `Resume · ${progressDetail(game, settings)}` : DIFFICULTY_HINTS[difficulty]}
        </Text>
        {game ? (
          <View className="bg-surface-muted mt-0.5 h-1 overflow-hidden rounded-full">
            <View
              className={clsx("h-full rounded-full", DIFFICULTY_DOT[difficulty])}
              style={{ width: `${completionPercent(game.values, game.givens)}%` }}
            />
          </View>
        ) : null}
      </View>
      {game ? (
        <Pressable
          onPress={onNewGame}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Start a new ${label} game`}
          className="border-line bg-surface-muted rounded-full border px-3 py-1.5 active:opacity-70"
        >
          <Text className="text-ink text-xs font-semibold">New</Text>
        </Pressable>
      ) : (
        <Text className="text-ink-soft text-xl">›</Text>
      )}
    </Pressable>
  );
}

/** Small "🔥 n" pill shown on the Daily Puzzle card while a streak is alive. */
function StreakChip({ count }: { count: number }) {
  const large = useWindowDimensions().width >= 700;
  return (
    <View className="bg-warning/20 flex-row items-center rounded-full px-2 py-0.5">
      <Text className={clsx("text-ink font-bold tabular-nums", large ? "text-sm" : "text-xs")}>
        🔥 {count}
      </Text>
    </View>
  );
}

/**
 * The Challenge card's counterpart to the streak chip: a permanent violet
 * difficulty badge. It fills the same slot in every state, so the two daily
 * cards read as deliberately different things (habit vs. hard mode) rather
 * than the challenge looking like it lost its streak.
 */
function ExtremeChip() {
  const large = useWindowDimensions().width >= 700;
  return (
    <View className="bg-difficulty-extreme/15 flex-row items-center rounded-full px-2 py-0.5">
      <Text className={clsx("text-ink font-bold", large ? "text-sm" : "text-xs")}>Extreme</Text>
    </View>
  );
}

function DailyCard({
  track,
  title,
  subtitle,
  progress,
  streak = 0,
  settings,
  onPress,
}: {
  track: DailyTrack;
  title: string;
  subtitle: string;
  progress: DailyCardState;
  /** Current daily streak; rendered as a flame chip when > 0. Daily track only. */
  streak?: number;
  settings: { timerEnabled: boolean; mistakeTrackingEnabled: boolean };
  onPress: () => void;
}) {
  const large = useWindowDimensions().width >= 700;
  const accent = DAILY_TRACK_DOT[track];
  const completed = progress.completed;
  const inProgress = progress.game != null;
  const streakLabel = streak > 0 ? `, ${streak} day streak` : "";
  // Each card's identity badge: the daily wears its live streak, the challenge
  // its difficulty. Rendered in the same header slot in every state.
  const chip =
    track === "challenge" ? <ExtremeChip /> : streak > 0 ? <StreakChip count={streak} /> : null;
  const a11yTitle = track === "challenge" ? `${title}, extreme difficulty` : title;

  // A finished daily gets its own celebratory, success-tinted treatment so it
  // reads as an accomplishment rather than an unfinished task. It stays tappable
  // to revisit the result + solved grid when we still have the game.
  if (completed) {
    const canViewResult = progress.game != null;
    const solveTime =
      settings.timerEnabled && progress.game
        ? formatDuration((progress.game as GameState).elapsedSeconds)
        : null;
    const tail = canViewResult ? "View result ›" : "Done for today";
    const footer = solveTime ? `${solveTime} · ${tail}` : tail;
    return (
      <Pressable
        onPress={onPress}
        disabled={!canViewResult}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canViewResult }}
        accessibilityLabel={
          canViewResult
            ? `${a11yTitle}, completed today${streakLabel}, view result`
            : `${a11yTitle}, completed today${streakLabel}`
        }
        className={clsx(
          "border-success/30 bg-success/10 flex-1 justify-between gap-3 rounded-2xl border",
          large ? "p-5" : "p-4",
          canViewResult ? "active:opacity-80" : "opacity-95",
        )}
      >
        <View className="h-5 flex-row items-center justify-between gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-success text-base font-bold">✓</Text>
            <Text className="text-success text-xs font-bold tracking-widest uppercase">Solved</Text>
          </View>
          {chip}
        </View>
        <View className="gap-0.5">
          <Text className={clsx("text-ink font-semibold", large ? "text-xl" : "text-base")}>
            {title}
          </Text>
          <Text className={clsx("text-success font-medium", large ? "text-base" : "text-sm")}>
            {footer}
          </Text>
        </View>
      </Pressable>
    );
  }

  // Not started with a streak on the line: swap the generic subtitle for a
  // nudge, since skipping today resets the run to zero.
  const meta = inProgress
    ? `Resume · ${progressDetail(progress.game as GameState, settings)}`
    : streak > 0
      ? "Keep your streak going"
      : subtitle;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${a11yTitle}${streakLabel}`}
      className={clsx(
        "bg-surface flex-1 gap-2 rounded-2xl border active:opacity-80",
        // A violet-tinted frame sets the extreme track apart from the habit one.
        track === "challenge" ? "border-difficulty-extreme/30" : "border-line",
        large ? "p-5" : "p-4",
      )}
    >
      <View className="h-5 flex-row items-center justify-between gap-1.5">
        <View className={clsx("h-1.5 w-8 rounded-full", accent)} />
        {chip}
      </View>
      <View className="gap-0.5">
        <Text className={clsx("text-ink font-semibold", large ? "text-xl" : "text-base")}>
          {title}
        </Text>
        <Text className={clsx("text-ink-soft", large ? "text-base" : "text-sm")}>{meta}</Text>
      </View>
      {/* Slim progress bar for an in-progress daily — a nudge to come back. */}
      {inProgress ? (
        <View className="bg-surface-muted h-1 overflow-hidden rounded-full">
          <View
            className={clsx("h-full rounded-full", accent)}
            style={{ width: `${completionPercent(progress.game!.values, progress.game!.givens)}%` }}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function MiniButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: "stats" | "settings";
  onPress: () => void;
}) {
  const large = useWindowDimensions().width >= 700;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={clsx(
        "border-line bg-surface flex-1 flex-row items-center justify-center gap-2 rounded-2xl border active:opacity-80",
        large ? "py-4" : "py-3.5",
      )}
    >
      <SimpleIcon name={icon} />
      <Text className={clsx("text-ink font-semibold", large ? "text-lg" : "text-base")}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Progress without the difficulty (used where difficulty is already implied,
 * e.g. the daily cards): "62% · 03:21 · 1 mistake". */
function progressDetail(
  game: GameState,
  settings: { timerEnabled: boolean; mistakeTrackingEnabled: boolean },
): string {
  const parts = [`${completionPercent(game.values, game.givens)}%`];
  if (settings.timerEnabled) {
    parts.push(formatDuration(game.elapsedSeconds));
  }
  if (settings.mistakeTrackingEnabled && game.mistakes > 0) {
    parts.push(`${game.mistakes} mistake${game.mistakes > 1 ? "s" : ""}`);
  }
  return parts.join(" · ");
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
      {children}
    </Text>
  );
}
