import type { DailyTrack } from "@/domain/daily";

import { clsx } from "clsx";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, useWindowDimensions } from "react-native";

import { AppMark } from "@/components/AppMark";
import { Screen } from "@/components/Screen";
import { SimpleIcon } from "@/components/SimpleIcon";
import { getDailyProgress } from "@/data/repositories/dailyRepository";
import { abandonGame, getActiveGame, getGameById } from "@/data/repositories/gameRepository";
import { getRandomPuzzleByDifficulty } from "@/data/repositories/puzzleRepository";
import { isGivenCell } from "@/domain/sudoku/board";
import {
  DAILY_TRACK_DOT,
  DIFFICULTY_DOT,
  DIFFICULTY_LABELS,
} from "@/domain/sudoku/difficultyPresentation";
import {
  CELL_COUNT,
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
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [dailyCards, setDailyCards] = useState<Record<DailyTrack, DailyCardState>>({
    daily: { game: null, completed: false },
    challenge: { game: null, completed: false },
  });
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadHome = async () => {
        const [game, daily, challenge] = await Promise.all([
          getActiveGame(),
          loadDailyCard("daily"),
          loadDailyCard("challenge"),
        ]);
        if (!cancelled) {
          setActiveGame(game);
          setDailyCards({ daily, challenge });
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
        const game = await launchPuzzle(loadPuzzle, dailyTrack);
        if (game) {
          openGame(game);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, openGame],
  );

  // Start a fresh (non-daily) game. If a game is already in progress, confirm
  // first and abandon it (which never touches stats).
  const requestNewGame = useCallback(
    (loadPuzzle: () => Promise<Puzzle | null>) => {
      const inProgress =
        activeGame && activeGame.status !== "completed" && activeGame.status !== "abandoned";
      const start = async () => {
        if (busy) return;
        setBusy(true);
        try {
          if (inProgress) {
            await abandonGame(activeGame.id);
            void track("puzzle_abandoned", { difficulty: activeGame.difficulty });
          }
          const game = await launchPuzzle(loadPuzzle);
          if (game) {
            openGame(game);
          }
        } finally {
          setBusy(false);
        }
      };
      if (inProgress) {
        Alert.alert(
          "Start a new game?",
          "Your current game will be abandoned. This won't affect your stats.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Start new", style: "destructive", onPress: () => void start() },
          ],
        );
        return;
      }
      void start();
    },
    [activeGame, busy, openGame],
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

          {activeGame ? (
            <ContinueCard
              game={activeGame}
              settings={settings}
              onPress={() => openGame(activeGame)}
            />
          ) : null}

          <View className="flex-row gap-3">
            <DailyCard
              title="Daily Puzzle"
              subtitle="Today's puzzle"
              accent={DAILY_TRACK_DOT.daily}
              progress={dailyCards.daily}
              settings={settings}
              onPress={() =>
                dailyCards.daily.completed && dailyCards.daily.game
                  ? openGame(dailyCards.daily.game)
                  : startFromPuzzle(() => getDailyPuzzle("daily"), "daily", dailyCards.daily.game)
              }
            />
            <DailyCard
              title="Daily Challenge"
              subtitle="A tougher grid"
              accent={DAILY_TRACK_DOT.challenge}
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
            <SectionLabel>New Game</SectionLabel>
            {large ? (
              // Tablet: a 2x2 card grid that fills the wider canvas, instead of
              // a thin single-column list floating in the middle.
              <View className="flex-row flex-wrap gap-3">
                {NEW_GAME_DIFFICULTIES.map((difficulty) => (
                  <Pressable
                    key={difficulty}
                    onPress={() => requestNewGame(() => getRandomPuzzleByDifficulty(difficulty))}
                    accessibilityRole="button"
                    accessibilityLabel={DIFFICULTY_LABELS[difficulty]}
                    style={{ width: "48.5%" }}
                    className="border-line bg-surface grow flex-row items-center gap-3 rounded-2xl border px-5 py-5 active:opacity-70"
                  >
                    <View className={clsx("h-3 w-3 rounded-full", DIFFICULTY_DOT[difficulty])} />
                    <View className="flex-1">
                      <Text className="text-ink text-lg font-semibold">
                        {DIFFICULTY_LABELS[difficulty]}
                      </Text>
                      <Text className="text-ink-soft text-sm">{DIFFICULTY_HINTS[difficulty]}</Text>
                    </View>
                    <Text className="text-ink-soft text-xl">›</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="border-line bg-surface overflow-hidden rounded-2xl border">
                {NEW_GAME_DIFFICULTIES.map((difficulty, i) => (
                  <Pressable
                    key={difficulty}
                    onPress={() => requestNewGame(() => getRandomPuzzleByDifficulty(difficulty))}
                    accessibilityRole="button"
                    accessibilityLabel={DIFFICULTY_LABELS[difficulty]}
                    className={clsx(
                      "flex-row items-center gap-3 px-5 active:opacity-70",
                      compact ? "py-3" : "py-4",
                      i > 0 && "border-line border-t",
                    )}
                  >
                    <View
                      className={clsx("h-2.5 w-2.5 rounded-full", DIFFICULTY_DOT[difficulty])}
                    />
                    <View className="flex-1">
                      <Text className="text-ink text-base font-semibold">
                        {DIFFICULTY_LABELS[difficulty]}
                      </Text>
                      <Text className="text-ink-soft text-sm">{DIFFICULTY_HINTS[difficulty]}</Text>
                    </View>
                    <Text className="text-ink-soft text-xl">›</Text>
                  </Pressable>
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

function ContinueCard({
  game,
  settings,
  onPress,
}: {
  game: GameState;
  settings: { timerEnabled: boolean; mistakeTrackingEnabled: boolean };
  onPress: () => void;
}) {
  const large = useWindowDimensions().width >= 700;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Continue your current game"
      className={clsx("bg-primary gap-1 rounded-2xl active:opacity-80", large ? "p-6" : "p-5")}
    >
      <Text className="text-on-primary/80 text-xs font-semibold tracking-widest uppercase">
        Resume game
      </Text>
      <Text className={clsx("text-on-primary font-bold", large ? "text-4xl" : "text-2xl")}>
        Continue
      </Text>
      <Text className={clsx("text-on-primary/80", large ? "text-base" : "text-sm")}>
        {progressText(game, settings)}
      </Text>
    </Pressable>
  );
}

function DailyCard({
  title,
  subtitle,
  accent,
  progress,
  settings,
  onPress,
}: {
  title: string;
  subtitle: string;
  accent: string;
  progress: DailyCardState;
  settings: { timerEnabled: boolean; mistakeTrackingEnabled: boolean };
  onPress: () => void;
}) {
  const large = useWindowDimensions().width >= 700;
  const completed = progress.completed;
  const inProgress = progress.game != null;

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
          canViewResult ? `${title}, completed today, view result` : `${title}, completed today`
        }
        className={clsx(
          "border-success/30 bg-success/10 flex-1 justify-between gap-3 rounded-2xl border",
          large ? "p-5" : "p-4",
          canViewResult ? "active:opacity-80" : "opacity-95",
        )}
      >
        <View className="flex-row items-center gap-1.5">
          <Text className="text-success text-base font-bold">✓</Text>
          <Text className="text-success text-xs font-bold tracking-widest uppercase">Solved</Text>
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

  const meta = inProgress
    ? `Resume · ${progressDetail(progress.game as GameState, settings)}`
    : subtitle;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={clsx(
        "border-line bg-surface flex-1 gap-2 rounded-2xl border active:opacity-80",
        large ? "p-5" : "p-4",
      )}
    >
      <View className={clsx("h-1.5 w-8 rounded-full", accent)} />
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
            style={{ width: `${completionPercent(progress.game as GameState)}%` }}
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

/** Percent of the *blank* (non-given) cells the player has filled, so a fresh
 * puzzle reads 0% regardless of how many clues it started with. */
function completionPercent(game: GameState): number {
  let blanks = 0;
  let filled = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (isGivenCell(game.givens, i)) {
      continue;
    }
    blanks += 1;
    if (game.values[i] != null) {
      filled += 1;
    }
  }
  return blanks === 0 ? 100 : Math.round((filled / blanks) * 100);
}

/** Progress without the difficulty (used where difficulty is already implied,
 * e.g. the daily cards): "62% · 03:21 · 1 mistake". */
function progressDetail(
  game: GameState,
  settings: { timerEnabled: boolean; mistakeTrackingEnabled: boolean },
): string {
  const parts = [`${completionPercent(game)}%`];
  if (settings.timerEnabled) {
    parts.push(formatDuration(game.elapsedSeconds));
  }
  if (settings.mistakeTrackingEnabled && game.mistakes > 0) {
    parts.push(`${game.mistakes} mistake${game.mistakes > 1 ? "s" : ""}`);
  }
  return parts.join(" · ");
}

/** Progress prefixed with the difficulty, for the generic Continue card. */
function progressText(
  game: GameState,
  settings: { timerEnabled: boolean; mistakeTrackingEnabled: boolean },
): string {
  return `${DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty} · ${progressDetail(game, settings)}`;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
      {children}
    </Text>
  );
}
