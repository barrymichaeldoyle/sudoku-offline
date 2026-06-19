import { clsx } from "clsx";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Share, useWindowDimensions } from "react-native";

import { SudokuBoard } from "@/components/Board/SudokuBoard";
import { GameControls } from "@/components/GameControls";
import { NumberPad } from "@/components/NumberPad";
import { RemoveAdsButton } from "@/components/RemoveAdsButton";
import { Screen } from "@/components/Screen";
import { SimpleIcon, type SimpleIconName } from "@/components/SimpleIcon";
import { getRandomPuzzleByDifficulty } from "@/data/repositories/puzzleRepository";
import { formatShareText } from "@/domain/shareText";
import { NEW_GAME_DIFFICULTIES, type GameState } from "@/domain/sudoku/types";
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
  const [boardSize, setBoardSize] = useState(0);

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
      <View className="flex-1 gap-3 p-4">
        <GameHeader onBack={() => router.back()} onSettings={() => router.push("/settings")} />
        <View
          className="flex-1 items-center justify-center"
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setBoardSize(Math.floor(Math.min(width, height)));
          }}
        >
          {boardSize > 0 ? <SudokuBoard size={boardSize} /> : null}
        </View>
        <View className="gap-3">
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

function GameHeader({ onBack, onSettings }: { onBack: () => void; onSettings: () => void }) {
  const game = useGameStore((s) => s.game);
  const running = useGameStore((s) => s.running);
  const pause = useGameStore((s) => s.pause);
  const timerEnabled = useSettingsStore((s) => s.settings.timerEnabled);
  const mistakeCheckingEnabled = useSettingsStore((s) => s.settings.mistakeCheckingEnabled);
  const elapsed = useElapsedSeconds();

  if (!game) {
    return null;
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          className="-ml-2 flex-row items-center py-1 pr-4 active:opacity-60"
        >
          <SimpleIcon name="back" tone="primary" size={20} />
          <Text className="text-primary text-base font-medium">Home</Text>
        </Pressable>

        <View className="flex-row items-center gap-2">
          {timerEnabled && running ? (
            <Pressable
              onPress={pause}
              accessibilityRole="button"
              accessibilityLabel="Pause game"
              className="bg-surface-muted flex-row items-center gap-1.5 rounded-full px-4 py-1.5 active:opacity-70"
            >
              <SimpleIcon name="pause" tone="muted" />
              <Text className="text-ink text-sm font-semibold">Pause</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            className="bg-surface-muted h-9 w-9 items-center justify-center rounded-full active:opacity-70"
          >
            <SimpleIcon name="settings" tone="muted" />
          </Pressable>
        </View>
      </View>

      <View className="flex-row items-center gap-3">
        <Text className="text-ink text-lg font-semibold">
          {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty}
        </Text>
        {timerEnabled ? (
          <Text className="text-ink-soft text-base tabular-nums">{formatDuration(elapsed)}</Text>
        ) : null}
        {mistakeCheckingEnabled ? (
          <Text className="text-ink-soft text-base tabular-nums">Mistakes {game.mistakes}</Text>
        ) : null}
      </View>
    </View>
  );
}

function PausedOverlay() {
  const router = useRouter();
  const resume = useGameStore((s) => s.resume);
  const { height } = useWindowDimensions();
  const cardOffset = -Math.min(96, Math.max(56, height * 0.1));

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/70 p-8">
      <View
        className="border-line bg-surface min-h-96 w-full items-center justify-center gap-3 rounded-3xl border p-8"
        style={{ transform: [{ translateY: cardOffset }] }}
      >
        <Text className="text-ink text-2xl font-bold">Paused</Text>
        <Text className="text-ink-soft -mt-1 text-sm">Your progress is saved</Text>
        <OverlayButton
          icon="play"
          label="Resume"
          primary
          onPress={resume}
          accessibilityLabel="Resume game"
          className="mt-2"
        />
        <OverlayButton
          icon="settings"
          label="Settings"
          onPress={() => router.push("/settings")}
          accessibilityLabel="Open settings"
        />
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
            "mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4 active:opacity-80",
            busy && "opacity-50",
          )}
        >
          <SimpleIcon name="play" tone="onPrimary" />
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
            "mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-primary py-4 active:opacity-80",
            busy && "opacity-50",
          )}
        >
          <SimpleIcon name="plus" tone="primary" />
          <Text className="text-primary text-base font-semibold">Remove ads · Unlimited hints</Text>
        </Pressable>

        <Pressable
          onPress={dismissHintPrompt}
          accessibilityRole="button"
          accessibilityLabel="Close hint prompt"
          className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl py-3 active:opacity-60"
        >
          <SimpleIcon name="close" tone="muted" />
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
  const settings = useSettingsStore((s) => s.settings);
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
        <Text className="text-ink-soft text-center">{completionSummary(game, settings)}</Text>
        {daily?.streak && daily.streak.current > 0 ? (
          <Text className="text-warning text-center text-base font-semibold">
            🔥 {daily.streak.current} day streak
          </Text>
        ) : null}

        <OverlayButton
          icon="share"
          label="Share Result"
          primary
          onPress={onShare}
          accessibilityLabel="Share result"
          className="mt-4"
        />
        {canReplay ? (
          <OverlayButton
            icon="plus"
            label="New Game"
            onPress={onNewGame}
            accessibilityLabel="Start a new game"
          />
        ) : null}
        <OverlayButton
          icon="home"
          label="Back to Home"
          onPress={() => router.replace("/")}
          accessibilityLabel="Back to home"
        />
        <RemoveAdsButton source="completion" />
      </View>
    </View>
  );
}

function completionSummary(
  game: GameState,
  settings: { timerEnabled: boolean; mistakeCheckingEnabled: boolean },
): string {
  const parts = [DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty];
  if (settings.timerEnabled) {
    parts.push(formatDuration(game.elapsedSeconds));
  }
  if (settings.mistakeCheckingEnabled) {
    parts.push(`Mistakes: ${game.mistakes}`);
  }
  parts.push(`Hints: ${game.hintsUsed}`);
  return parts.join(" · ");
}

function OverlayButton({
  icon,
  label,
  primary,
  onPress,
  accessibilityLabel,
  className,
}: {
  icon: SimpleIconName;
  label: string;
  primary?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={clsx(
        "w-full flex-row items-center justify-center gap-2 rounded-2xl py-4 active:opacity-80",
        primary ? "bg-primary" : "border-line bg-surface-muted border",
        className,
      )}
    >
      <SimpleIcon name={icon} tone={primary ? "onPrimary" : "muted"} />
      <Text className={clsx("text-lg font-semibold", primary ? "text-on-primary" : "text-ink")}>
        {label}
      </Text>
    </Pressable>
  );
}
