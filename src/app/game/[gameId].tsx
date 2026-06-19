import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Share } from "react-native";

import { SudokuBoard } from "@/components/Board/SudokuBoard";
import { GameControls } from "@/components/GameControls";
import { NumberPad } from "@/components/NumberPad";
import { Screen } from "@/components/Screen";
import { getRandomPuzzleByDifficulty } from "@/data/repositories/puzzleRepository";
import { formatShareText } from "@/domain/shareText";
import { NEW_GAME_DIFFICULTIES } from "@/domain/sudoku/types";
import { track } from "@/services/analyticsService";
import { launchPuzzle } from "@/services/gameLauncher";
import { getDailyCompletionInfo, type DailyCompletionInfo } from "@/services/statsService";
import { formatDuration, useElapsedSeconds } from "@/state/useElapsedSeconds";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, Text, View } from "@/tw";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  extreme: "Extreme",
};

export default function GameScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();

  const game = useGameStore((s) => s.game);
  const loading = useGameStore((s) => s.loading);
  const justCompleted = useGameStore((s) => s.justCompleted);
  const loadGame = useGameStore((s) => s.loadGame);
  const flushAndPause = useGameStore((s) => s.flushAndPause);

  useEffect(() => {
    if (gameId) {
      void loadGame(gameId);
    }
  }, [gameId, loadGame]);

  // Auto-pause (and persist) when the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        flushAndPause();
      }
    });
    return () => {
      sub.remove();
      flushAndPause();
    };
  }, [flushAndPause]);

  if (!game) {
    return (
      <Screen className="flex-1 bg-white dark:bg-neutral-950">
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-500">{loading ? "Loading…" : "Game not found"}</Text>
        </View>
      </Screen>
    );
  }

  const paused = game.status === "paused" && !justCompleted;

  return (
    <Screen className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-1 gap-4 p-4">
        <GameHeader onBack={() => router.back()} />
        <SudokuBoard />
        <View className="mt-auto gap-3">
          <GameControls />
          <NumberPad />
        </View>
      </View>

      {paused ? <PausedOverlay /> : null}
      {justCompleted ? <CompletionOverlay /> : null}
    </Screen>
  );
}

function GameHeader({ onBack }: { onBack: () => void }) {
  const game = useGameStore((s) => s.game);
  const running = useGameStore((s) => s.running);
  const pause = useGameStore((s) => s.pause);
  const timerEnabled = useSettingsStore((s) => s.settings.timerEnabled);
  const elapsed = useElapsedSeconds();

  if (!game) {
    return null;
  }

  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        className="py-1 pr-4"
      >
        <Text className="text-base text-blue-600 dark:text-blue-400">‹ Home</Text>
      </Pressable>

      <View className="flex-row items-center gap-3">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty}
        </Text>
        {timerEnabled ? (
          <Text className="text-base text-neutral-500 tabular-nums">{formatDuration(elapsed)}</Text>
        ) : null}
      </View>

      <View className="flex-row items-center gap-3">
        <Text className="text-base text-neutral-500">✕ {game.mistakes}</Text>
        {timerEnabled && running ? (
          <Pressable
            onPress={pause}
            accessibilityRole="button"
            accessibilityLabel="Pause game"
            className="py-1 pl-1"
          >
            <Text className="text-base text-blue-600 dark:text-blue-400">Pause</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PausedOverlay() {
  const resume = useGameStore((s) => s.resume);
  return (
    <View className="absolute inset-0 items-center justify-center bg-black/60 p-8">
      <View className="w-full items-center gap-4 rounded-2xl bg-white p-8 dark:bg-neutral-900">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Paused</Text>
        <Pressable
          onPress={resume}
          accessibilityRole="button"
          accessibilityLabel="Resume game"
          className="w-full items-center rounded-xl bg-blue-600 py-4"
        >
          <Text className="text-lg font-semibold text-white">Resume</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CompletionOverlay() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const setGame = useGameStore((s) => s.setGame);
  const [daily, setDaily] = useState<DailyCompletionInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!game) {
      return;
    }
    let cancelled = false;
    getDailyCompletionInfo(game.id).then((info) => {
      if (cancelled || !info) {
        return;
      }
      setDaily(info);
      void track("daily_completed", { track: info.track });
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

  if (!game) {
    return null;
  }

  const onShare = () => {
    void track("share_result_tapped", { difficulty: game.difficulty });
    void Share.share({
      message: formatShareText({
        difficulty: game.difficulty,
        elapsedSeconds: game.elapsedSeconds,
        mistakes: game.mistakes,
        hintsUsed: game.hintsUsed,
        daily: daily
          ? { kind: daily.track, dateKey: daily.dateKey, streak: daily.streak?.current ?? 0 }
          : null,
      }),
    }).catch(() => {});
  };

  const onNewGame = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const next = await launchPuzzle(() => getRandomPuzzleByDifficulty(game.difficulty));
      if (next) {
        setGame(next);
        router.replace({ pathname: "/game/[gameId]", params: { gameId: next.id } });
      }
    } finally {
      setBusy(false);
    }
  };

  const heading =
    daily?.track === "challenge"
      ? "Challenge Complete"
      : daily
        ? "Daily Complete"
        : "Puzzle Complete";
  // "New Game" replays the same difficulty — only meaningful for the ordinary
  // difficulty-pool games (daily/challenge have no such pool to draw from).
  const canReplay = !daily && NEW_GAME_DIFFICULTIES.includes(game.difficulty);

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/50 p-8">
      <View className="w-full gap-2 rounded-2xl bg-white p-6 dark:bg-neutral-900">
        <Text className="text-center text-2xl font-bold text-neutral-900 dark:text-neutral-50">
          {heading}
        </Text>
        <Text className="text-center text-neutral-500">
          {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty} ·{" "}
          {formatDuration(game.elapsedSeconds)} · Mistakes: {game.mistakes} · Hints:{" "}
          {game.hintsUsed}
        </Text>
        {daily?.streak && daily.streak.current > 0 ? (
          <Text className="text-center text-base font-semibold text-orange-500">
            🔥 {daily.streak.current} day streak
          </Text>
        ) : null}

        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share result"
          className="mt-4 items-center rounded-xl bg-blue-600 py-4"
        >
          <Text className="text-lg font-semibold text-white">Share Result</Text>
        </Pressable>
        {canReplay ? (
          <Pressable
            onPress={onNewGame}
            accessibilityRole="button"
            accessibilityLabel="Start a new game"
            className="items-center rounded-xl bg-neutral-100 py-4 dark:bg-neutral-800"
          >
            <Text className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
              New Game
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          className="items-center rounded-xl bg-neutral-100 py-4 dark:bg-neutral-800"
        >
          <Text className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
            Back to Home
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
