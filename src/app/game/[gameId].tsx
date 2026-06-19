import { clsx } from "clsx";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Share } from "react-native";

import { SudokuBoard } from "@/components/Board/SudokuBoard";
import { GameControls } from "@/components/GameControls";
import { NumberPad } from "@/components/NumberPad";
import { RemoveAdsButton } from "@/components/RemoveAdsButton";
import { Screen } from "@/components/Screen";
import { getRandomPuzzleByDifficulty } from "@/data/repositories/puzzleRepository";
import { formatShareText } from "@/domain/shareText";
import { NEW_GAME_DIFFICULTIES } from "@/domain/sudoku/types";
import { track } from "@/services/analyticsService";
import { launchPuzzle } from "@/services/gameLauncher";
import { getDailyCompletionInfo, type DailyCompletionInfo } from "@/services/statsService";
import { formatDuration, useElapsedSeconds } from "@/state/useElapsedSeconds";
import { useEntitlementStore } from "@/state/useEntitlementStore";
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
  const hintPromptVisible = useGameStore((s) => s.hintPromptVisible);
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
      <Screen className="bg-canvas flex-1">
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-soft">{loading ? "Loading…" : "Game not found"}</Text>
        </View>
      </Screen>
    );
  }

  const paused = game.status === "paused" && !justCompleted;

  return (
    <Screen className="bg-canvas flex-1">
      <View className="flex-1 gap-4 p-4">
        <GameHeader onBack={() => router.back()} />
        <SudokuBoard />
        <View className="mt-auto gap-3">
          <GameControls />
          <NumberPad />
        </View>
      </View>

      {paused ? <PausedOverlay /> : null}
      {hintPromptVisible && !paused && !justCompleted ? <HintPromptOverlay /> : null}
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
        className="py-1 pr-4 active:opacity-60"
      >
        <Text className="text-primary text-base font-medium">‹ Home</Text>
      </Pressable>

      <View className="flex-row items-center gap-3">
        <Text className="text-ink text-base font-semibold">
          {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty}
        </Text>
        {timerEnabled ? (
          <Text className="text-ink-soft text-base tabular-nums">{formatDuration(elapsed)}</Text>
        ) : null}
      </View>

      <View className="flex-row items-center gap-3">
        <Text className="text-ink-soft text-base tabular-nums">✕ {game.mistakes}</Text>
        {timerEnabled && running ? (
          <Pressable
            onPress={pause}
            accessibilityRole="button"
            accessibilityLabel="Pause game"
            className="py-1 pl-1 active:opacity-60"
          >
            <Text className="text-primary text-base font-medium">Pause</Text>
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
      <View className="border-line bg-surface w-full items-center gap-5 rounded-3xl border p-8">
        <Text className="text-ink text-2xl font-bold">Paused</Text>
        <Pressable
          onPress={resume}
          accessibilityRole="button"
          accessibilityLabel="Resume game"
          className="bg-primary w-full items-center rounded-2xl py-4 active:opacity-80"
        >
          <Text className="text-on-primary text-lg font-semibold">Resume</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HintPromptOverlay() {
  const confirmRewardedHint = useGameStore((s) => s.confirmRewardedHint);
  const dismissHintPrompt = useGameStore((s) => s.dismissHintPrompt);
  const requestHint = useGameStore((s) => s.requestHint);
  const purchaseRemoveAds = useEntitlementStore((s) => s.purchaseRemoveAds);
  const [busy, setBusy] = useState(false);

  // The store only opens this prompt when a rewarded ad is actually loaded
  // (offline players get a free hint instead), so we always offer the ad here.
  const onWatch = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await confirmRewardedHint();
    } finally {
      setBusy(false);
    }
  };

  const onUpgrade = async () => {
    if (busy) {
      return;
    }
    void track("premium_upgrade_tapped", { source: "hint_prompt" });
    setBusy(true);
    try {
      const ok = await purchaseRemoveAds();
      if (ok) {
        // Now premium — close the prompt and reveal the hint they asked for.
        dismissHintPrompt();
        void requestHint();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/50 p-8">
      <View className="border-line bg-surface w-full gap-2 rounded-3xl border p-6">
        <Text className="text-ink text-center text-2xl font-bold">Need a hint?</Text>
        <Text className="text-ink-soft text-center">Watch a short ad to reveal one hint.</Text>

        <Pressable
          onPress={onWatch}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Watch ad to reveal a hint"
          className={clsx(
            "mt-4 items-center rounded-2xl bg-primary py-4 active:opacity-80",
            busy && "opacity-50",
          )}
        >
          <Text className="text-on-primary text-lg font-semibold">
            {busy ? "Loading…" : "Watch Ad"}
          </Text>
        </Pressable>

        {/* Premium upsell — unlimited hints with no ads, works offline. */}
        <Pressable
          onPress={onUpgrade}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Remove ads for unlimited hints"
          className={clsx(
            "mt-2 items-center rounded-2xl border border-primary py-4 active:opacity-80",
            busy && "opacity-50",
          )}
        >
          <Text className="text-primary text-base font-semibold">Remove ads · Unlimited hints</Text>
        </Pressable>

        <Pressable
          onPress={dismissHintPrompt}
          accessibilityRole="button"
          accessibilityLabel="Close hint prompt"
          className="mt-2 items-center rounded-2xl py-3 active:opacity-60"
        >
          <Text className="text-ink-soft text-base font-medium">Not now</Text>
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
      <View className="border-line bg-surface w-full gap-2 rounded-3xl border p-6">
        <Text className="text-ink text-center text-2xl font-bold">{heading}</Text>
        <Text className="text-ink-soft text-center">
          {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty} ·{" "}
          {formatDuration(game.elapsedSeconds)} · Mistakes: {game.mistakes} · Hints:{" "}
          {game.hintsUsed}
        </Text>
        {daily?.streak && daily.streak.current > 0 ? (
          <Text className="text-warning text-center text-base font-semibold">
            🔥 {daily.streak.current} day streak
          </Text>
        ) : null}

        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share result"
          className="bg-primary mt-4 items-center rounded-2xl py-4 active:opacity-80"
        >
          <Text className="text-on-primary text-lg font-semibold">Share Result</Text>
        </Pressable>
        {canReplay ? (
          <Pressable
            onPress={onNewGame}
            accessibilityRole="button"
            accessibilityLabel="Start a new game"
            className="border-line bg-surface-muted items-center rounded-2xl border py-4 active:opacity-80"
          >
            <Text className="text-ink text-lg font-medium">New Game</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          className="border-line bg-surface-muted items-center rounded-2xl border py-4 active:opacity-80"
        >
          <Text className="text-ink text-lg font-medium">Back to Home</Text>
        </Pressable>
        <RemoveAdsButton source="completion" />
      </View>
    </View>
  );
}
