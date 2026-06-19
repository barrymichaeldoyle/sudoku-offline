import type { DailyTrack } from "@/domain/daily";

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
    <Screen className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView contentContainerClassName="gap-8 p-6">
        <Text className="mt-6 text-center text-4xl font-bold text-neutral-900 dark:text-neutral-50">
          Sudoku
        </Text>

        <View className="gap-3">
          {activeGame ? (
            <PrimaryButton label="Continue" onPress={() => openGame(activeGame)} />
          ) : null}
          <PrimaryButton
            label="Daily Puzzle"
            variant="secondary"
            onPress={() => startFromPuzzle(() => getDailyPuzzle("daily"), "daily")}
          />
          <PrimaryButton
            label="Daily Challenge"
            variant="secondary"
            onPress={() => startFromPuzzle(() => getDailyPuzzle("challenge"), "challenge")}
          />
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
            New Game
          </Text>
          {NEW_GAME_DIFFICULTIES.map((difficulty) => (
            <PrimaryButton
              key={difficulty}
              label={DIFFICULTY_LABELS[difficulty]}
              variant="secondary"
              onPress={() => startFromPuzzle(() => getRandomPuzzleByDifficulty(difficulty))}
            />
          ))}
        </View>

        <View className="gap-3">
          <PrimaryButton label="Stats" variant="secondary" onPress={() => router.push("/stats")} />
          <PrimaryButton
            label="Settings"
            variant="secondary"
            onPress={() => router.push("/settings")}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

function PrimaryButton({ label, onPress, variant = "primary" }: PrimaryButtonProps) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={
        isPrimary
          ? "items-center rounded-xl bg-blue-600 py-4"
          : "items-center rounded-xl bg-neutral-100 py-4 dark:bg-neutral-800"
      }
    >
      <Text
        className={
          isPrimary
            ? "text-lg font-semibold text-white"
            : "text-lg font-medium text-neutral-900 dark:text-neutral-100"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
