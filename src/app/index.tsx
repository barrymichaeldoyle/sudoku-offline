import type { DailyTrack } from "@/domain/daily";

import { clsx } from "clsx";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { Screen } from "@/components/Screen";
import { getActiveGame } from "@/data/repositories/gameRepository";
import { getRandomPuzzleByDifficulty } from "@/data/repositories/puzzleRepository";
import {
  NEW_GAME_DIFFICULTIES,
  type Difficulty,
  type GameState,
  type Puzzle,
} from "@/domain/sudoku/types";
import { formatDuration } from "@/domain/time";
import { getDailyPuzzle } from "@/services/dailyService";
import { launchPuzzle } from "@/services/gameLauncher";
import { useGameStore } from "@/state/useGameStore";
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

export default function Home() {
  const router = useRouter();
  const setGame = useGameStore((s) => s.setGame);
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getActiveGame().then((game) => {
        if (!cancelled) setActiveGame(game);
      });
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
    async (loadPuzzle: () => Promise<Puzzle | null>, dailyTrack?: DailyTrack) => {
      if (busy) return;
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
          <ContinueCard game={activeGame} onPress={() => openGame(activeGame)} />
        ) : null}

        <View className="flex-row gap-3">
          <DailyCard
            title="Daily Puzzle"
            subtitle="Today's puzzle"
            accent="bg-accent"
            onPress={() => startFromPuzzle(() => getDailyPuzzle("daily"), "daily")}
          />
          <DailyCard
            title="Daily Challenge"
            subtitle="A tougher grid"
            accent="bg-warning"
            onPress={() => startFromPuzzle(() => getDailyPuzzle("challenge"), "challenge")}
          />
        </View>

        <View className="gap-3">
          <SectionLabel>New Game</SectionLabel>
          <View className="border-line bg-surface overflow-hidden rounded-2xl border">
            {NEW_GAME_DIFFICULTIES.map((difficulty, i) => (
              <Pressable
                key={difficulty}
                onPress={() => startFromPuzzle(() => getRandomPuzzleByDifficulty(difficulty))}
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
                <Text className="text-ink-dim text-xl">›</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="flex-row gap-3">
          <MiniButton label="Stats" onPress={() => router.push("/stats")} />
          <MiniButton label="Settings" onPress={() => router.push("/settings")} />
        </View>
      </ScrollView>
    </Screen>
  );
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

function ContinueCard({ game, onPress }: { game: GameState; onPress: () => void }) {
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
      <Text className="text-on-primary/80 text-sm">
        {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty} ·{" "}
        {formatDuration(game.elapsedSeconds)}
        {game.mistakes > 0 ? ` · ${game.mistakes} mistake${game.mistakes > 1 ? "s" : ""}` : ""}
      </Text>
    </Pressable>
  );
}

function DailyCard({
  title,
  subtitle,
  accent,
  onPress,
}: {
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="border-line bg-surface flex-1 gap-2 rounded-2xl border p-4 active:opacity-80"
    >
      <View className={clsx("h-1.5 w-8 rounded-full", accent)} />
      <View className="gap-0.5">
        <Text className="text-ink text-base font-semibold">{title}</Text>
        <Text className="text-ink-soft text-sm">{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function MiniButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="border-line bg-surface flex-1 items-center rounded-2xl border py-3.5 active:opacity-80"
    >
      <Text className="text-ink text-base font-semibold">{label}</Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-dim px-1 text-xs font-semibold tracking-widest uppercase">
      {children}
    </Text>
  );
}
