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
      <ScrollView contentContainerClassName="gap-8 px-6 pb-10">
        <View className="mt-8 items-center gap-1">
          <Text className="text-ink text-center text-4xl font-bold tracking-tight">Sudoku</Text>
          <Text className="text-ink-soft text-center text-sm font-medium">
            Classic puzzles · Works offline
          </Text>
        </View>

        <View className="gap-3">
          {activeGame ? (
            <PrimaryButton label="Continue" onPress={() => openGame(activeGame)} />
          ) : null}
          <PrimaryButton
            label="Daily Puzzle"
            hint="A fresh puzzle every day"
            variant="secondary"
            onPress={() => startFromPuzzle(() => getDailyPuzzle("daily"), "daily")}
          />
          <PrimaryButton
            label="Daily Challenge"
            hint="A tougher daily grid"
            variant="secondary"
            onPress={() => startFromPuzzle(() => getDailyPuzzle("challenge"), "challenge")}
          />
        </View>

        <View className="gap-3">
          <SectionLabel>New Game</SectionLabel>
          {NEW_GAME_DIFFICULTIES.map((difficulty) => (
            <PrimaryButton
              key={difficulty}
              label={DIFFICULTY_LABELS[difficulty]}
              hint={DIFFICULTY_HINTS[difficulty]}
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

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-dim px-1 text-xs font-semibold tracking-widest uppercase">
      {children}
    </Text>
  );
}

type PrimaryButtonProps = {
  label: string;
  hint?: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

function PrimaryButton({ label, hint, onPress, variant = "primary" }: PrimaryButtonProps) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={clsx(
        "rounded-2xl px-5 py-4 active:opacity-80",
        isPrimary ? "items-center bg-primary" : "border border-line bg-surface",
      )}
    >
      <Text
        className={clsx(
          "text-lg",
          isPrimary ? "font-semibold text-on-primary" : "font-semibold text-ink",
        )}
      >
        {label}
      </Text>
      {!isPrimary && hint ? <Text className="text-ink-soft mt-0.5 text-sm">{hint}</Text> : null}
    </Pressable>
  );
}
