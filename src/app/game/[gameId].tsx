import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

import { SudokuBoard } from "@/components/Board/SudokuBoard";
import { GameControls } from "@/components/GameControls";
import { NumberPad } from "@/components/NumberPad";
import { Screen } from "@/components/Screen";
import { useGameStore } from "@/state/useGameStore";
import { Pressable, Text, View } from "@/tw";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export default function GameScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();

  const game = useGameStore((s) => s.game);
  const loading = useGameStore((s) => s.loading);
  const justCompleted = useGameStore((s) => s.justCompleted);
  const loadGame = useGameStore((s) => s.loadGame);

  useEffect(() => {
    if (gameId) {
      void loadGame(gameId);
    }
  }, [gameId, loadGame]);

  if (!game) {
    return (
      <Screen className="flex-1 bg-white dark:bg-neutral-950">
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-500">{loading ? "Loading…" : "Game not found"}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-1 gap-4 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="py-1 pr-4">
            <Text className="text-base text-blue-600 dark:text-blue-400">‹ Home</Text>
          </Pressable>
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty}
          </Text>
          <Text className="py-1 pl-4 text-base text-neutral-500">Mistakes: {game.mistakes}</Text>
        </View>

        <SudokuBoard />

        <View className="mt-auto gap-3">
          <GameControls />
          <NumberPad />
        </View>
      </View>

      {justCompleted ? <CompletionOverlay /> : null}
    </Screen>
  );
}

function CompletionOverlay() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  if (!game) {
    return null;
  }
  return (
    <View className="absolute inset-0 items-center justify-center bg-black/50 p-8">
      <View className="w-full gap-2 rounded-2xl bg-white p-6 dark:bg-neutral-900">
        <Text className="text-center text-2xl font-bold text-neutral-900 dark:text-neutral-50">
          Puzzle Complete
        </Text>
        <Text className="text-center text-neutral-500">
          {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty} · Mistakes: {game.mistakes} ·
          Hints: {game.hintsUsed}
        </Text>
        <Pressable
          onPress={() => router.replace("/")}
          className="mt-4 items-center rounded-xl bg-blue-600 py-4"
        >
          <Text className="text-lg font-semibold text-white">Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}
