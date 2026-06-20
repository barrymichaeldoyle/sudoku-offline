import type { DailyTrack } from "@/domain/daily";

import { clsx } from "clsx";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { Screen } from "@/components/Screen";
import { SimpleIcon } from "@/components/SimpleIcon";
import { getDailyProgress } from "@/data/repositories/dailyRepository";
import { abandonGame, getActiveGame, getGameById } from "@/data/repositories/gameRepository";
import { getRandomPuzzleByDifficulty } from "@/data/repositories/puzzleRepository";
import { isGivenCell } from "@/domain/sudoku/board";
import {
  CELL_COUNT,
  NEW_GAME_DIFFICULTIES,
  type Difficulty,
  type GameState,
  type Puzzle,
} from "@/domain/sudoku/types";
import { formatDuration } from "@/domain/time";
import { getDailyPuzzle, getLocalDateKey } from "@/services/dailyService";
import { launchPuzzle } from "@/services/gameLauncher";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, ScrollView, Text, View } from "@/tw";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  extreme: "Extreme",
};

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: "Relaxed solving",
  medium: "A steady challenge",
  hard: "For regular players",
  expert: "Few givens, real focus",
  extreme: "The toughest grids",
};

// A calm colour cue per difficulty — paired with the text label, never the sole
// indicator (see design guidelines §15.4).
const DIFFICULTY_DOT: Record<Difficulty, string> = {
  easy: "bg-success",
  medium: "bg-accent",
  hard: "bg-warning",
  expert: "bg-danger",
  extreme: "bg-primary",
};

type DailyCardState = {
  game: GameState | null;
  completed: boolean;
};

export default function Home() {
  const router = useRouter();
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
      <ScrollView contentContainerClassName="gap-7 px-5 pt-6 pb-10">
        <View className="items-center gap-3">
          <AppMark />
          <View className="items-center gap-1">
            <Text className="text-ink text-center text-4xl font-bold tracking-tight">Sudoku</Text>
            <Text className="text-ink-soft text-center text-sm font-medium">
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
            accent="bg-accent"
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
            accent="bg-warning"
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
          <View className="border-line bg-surface overflow-hidden rounded-2xl border">
            {NEW_GAME_DIFFICULTIES.map((difficulty, i) => (
              <Pressable
                key={difficulty}
                onPress={() => requestNewGame(() => getRandomPuzzleByDifficulty(difficulty))}
                accessibilityRole="button"
                accessibilityLabel={DIFFICULTY_LABELS[difficulty]}
                className={clsx(
                  "flex-row items-center gap-3 px-5 py-4 active:opacity-70",
                  i > 0 && "border-line border-t",
                )}
              >
                <View className={clsx("h-2.5 w-2.5 rounded-full", DIFFICULTY_DOT[difficulty])} />
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
        </View>

        <View className="flex-row gap-3">
          <MiniButton label="Stats" icon="stats" onPress={() => router.push("/stats")} />
          <MiniButton label="Settings" icon="settings" onPress={() => router.push("/settings")} />
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

/** A small 3x3 grid mark with one highlighted cell — the app's visual motif. */
function AppMark() {
  return (
    <View className="border-line bg-surface gap-1 rounded-2xl border p-2.5">
      {[0, 1, 2].map((r) => (
        <View key={r} className="flex-row gap-1">
          {[0, 1, 2].map((c) => (
            <View
              key={c}
              className={clsx(
                "h-3 w-3 rounded-sm",
                r === 0 && c === 1 ? "bg-warning" : "bg-primary/15",
              )}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function ContinueCard({
  game,
  settings,
  onPress,
}: {
  game: GameState;
  settings: { timerEnabled: boolean; mistakeCheckingEnabled: boolean };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Continue your current game"
      className="bg-primary gap-1 rounded-2xl p-5 active:opacity-80"
    >
      <Text className="text-on-primary/80 text-xs font-semibold tracking-widest uppercase">
        Resume game
      </Text>
      <Text className="text-on-primary text-2xl font-bold">Continue</Text>
      <Text className="text-on-primary/80 text-sm">{progressText(game, settings)}</Text>
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
  settings: { timerEnabled: boolean; mistakeCheckingEnabled: boolean };
  onPress: () => void;
}) {
  const completed = progress.completed;
  const inProgress = progress.game != null;
  // A completed daily can still be opened to revisit its result + solved grid.
  const canViewResult = completed && progress.game != null;
  const meta = completed
    ? "Completed · View result"
    : inProgress
      ? `Resume · ${progressDetail(progress.game as GameState, settings)}`
      : subtitle;

  return (
    <Pressable
      onPress={onPress}
      disabled={completed && !canViewResult}
      accessibilityRole="button"
      accessibilityState={{ disabled: completed && !canViewResult }}
      accessibilityLabel={completed ? `${title}, completed today, view result` : title}
      className={clsx(
        "border-line bg-surface flex-1 gap-2 rounded-2xl border p-4",
        completed && !canViewResult ? "opacity-70" : "active:opacity-80",
      )}
    >
      <View className="flex-row items-center justify-between">
        <View className={clsx("h-1.5 w-8 rounded-full", accent)} />
        {completed ? <Text className="text-success text-sm font-bold">✓</Text> : null}
      </View>
      <View className="gap-0.5">
        <Text className="text-ink text-base font-semibold">{title}</Text>
        <Text className={clsx("text-sm", completed ? "text-success font-medium" : "text-ink-soft")}>
          {meta}
        </Text>
      </View>
      {/* Slim progress bar for an in-progress daily — a nudge to come back. */}
      {!completed && inProgress ? (
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="border-line bg-surface flex-1 flex-row items-center justify-center gap-2 rounded-2xl border py-3.5 active:opacity-80"
    >
      <SimpleIcon name={icon} />
      <Text className="text-ink text-base font-semibold">{label}</Text>
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
  settings: { timerEnabled: boolean; mistakeCheckingEnabled: boolean },
): string {
  const parts = [`${completionPercent(game)}%`];
  if (settings.timerEnabled) {
    parts.push(formatDuration(game.elapsedSeconds));
  }
  if (settings.mistakeCheckingEnabled && game.mistakes > 0) {
    parts.push(`${game.mistakes} mistake${game.mistakes > 1 ? "s" : ""}`);
  }
  return parts.join(" · ");
}

/** Progress prefixed with the difficulty, for the generic Continue card. */
function progressText(
  game: GameState,
  settings: { timerEnabled: boolean; mistakeCheckingEnabled: boolean },
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
