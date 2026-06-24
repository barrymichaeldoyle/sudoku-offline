import type { DailyTrack } from "@/domain/daily";
import type { PropsWithChildren } from "react";

import { clsx } from "clsx";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Share, useWindowDimensions } from "react-native";

import { SudokuBoard } from "@/components/Board/SudokuBoard";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { GameControls } from "@/components/GameControls";
import { InputModeToggle } from "@/components/InputModeToggle";
import { NativeAdCard } from "@/components/NativeAdCard";
import { NavBackButton } from "@/components/NavBackButton";
import { NumberPad } from "@/components/NumberPad";
import { RemoveAdsButton } from "@/components/RemoveAdsButton";
import { Screen } from "@/components/Screen";
import { SimpleIcon, type SimpleIconName } from "@/components/SimpleIcon";
import { getDailyForGame } from "@/data/repositories/dailyRepository";
import { getRandomPuzzleByDifficulty } from "@/data/repositories/puzzleRepository";
import {
  loadReminderPromptSeen,
  setReminderPromptSeen,
} from "@/data/repositories/settingsRepository";
import { formatShareText } from "@/domain/shareText";
import { NEW_GAME_DIFFICULTIES, type GameState } from "@/domain/sudoku/types";
import { track } from "@/services/analyticsService";
import { launchPuzzle } from "@/services/gameLauncher";
import {
  canOfferReminderPrompt,
  requestDailyReminderPermission,
  syncDailyReminderSchedule,
} from "@/services/notificationService";
import { getDailyCompletionInfo, type DailyCompletionInfo } from "@/services/statsService";
import { formatDuration, useElapsedSeconds } from "@/state/useElapsedSeconds";
import { useEntitlementStore } from "@/state/useEntitlementStore";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, ScrollView, Text, View } from "@/tw";

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
  const restart = useGameStore((s) => s.restart);
  const flushAndPause = useGameStore((s) => s.flushAndPause);
  const syncTimerFromSettings = useGameStore((s) => s.syncTimerFromSettings);
  const timerEnabled = useSettingsStore((s) => s.settings.timerEnabled);
  const [boardSize, setBoardSize] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (gameId) {
      void loadGame(gameId);
    }
  }, [gameId, loadGame]);

  useEffect(() => {
    syncTimerFromSettings();
  }, [timerEnabled, syncTimerFromSettings]);

  // Auto-pause (and persist) when the app leaves the foreground — only when timing.
  useEffect(() => {
    if (!timerEnabled) {
      return;
    }
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        flushAndPause();
      }
    });
    return () => {
      sub.remove();
      flushAndPause();
    };
  }, [flushAndPause, timerEnabled]);

  // Persist progress when leaving the game screen without pausing.
  useEffect(() => {
    if (timerEnabled) {
      return;
    }
    return () => {
      flushAndPause();
    };
  }, [flushAndPause, timerEnabled]);

  if (!game) {
    return (
      <Screen className="bg-canvas flex-1">
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-soft">{loading ? "Loading…" : "Game not found"}</Text>
        </View>
      </Screen>
    );
  }

  const paused = timerEnabled && game.status === "paused" && !justCompleted;

  return (
    <Screen className="bg-canvas flex-1">
      <View className="w-full flex-1 gap-3 self-center p-4">
        <GameHeader onBack={() => router.back()} onSettings={() => router.push("/settings")} />
        <View
          // Bottom-aligned so the grid→actions gap equals the actions→numbers
          // gap (both the column's gap-3); leftover slack sits above the grid.
          className="flex-1 items-center justify-end"
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            // Reserve room for the input-mode toggle row above the grid.
            const nextSize = Math.floor(Math.min(width, height - 44));
            setBoardSize((current) => (current === nextSize ? current : nextSize));
          }}
        >
          {boardSize > 0 ? (
            <View style={{ width: boardSize }} className="gap-2">
              <View className="flex-row items-center justify-between">
                <ResetButton onPress={() => setShowResetConfirm(true)} />
                <InputModeToggle />
              </View>
              <View style={{ width: boardSize, height: boardSize }}>
                <SudokuBoard size={boardSize} />
                {paused ? <PausedOverlay boardSize={boardSize} /> : null}
              </View>
            </View>
          ) : null}
        </View>
        <View className="gap-3">
          <GameControls />
          <NumberPad />
        </View>
      </View>
      {hintPromptVisible && !paused && !justCompleted ? <HintPromptOverlay /> : null}
      {showResetConfirm && game.status !== "completed" ? (
        <ResetConfirmOverlay
          onConfirm={() => {
            restart();
            setShowResetConfirm(false);
          }}
          onCancel={() => setShowResetConfirm(false)}
        />
      ) : null}
      {game.status === "completed" ? (
        <>
          {/* Confetti only celebrates the actual win, not a later revisit of a
              completed daily/challenge from Home. */}
          {justCompleted ? <ConfettiBurst /> : null}
          <CompletionOverlay justCompleted={justCompleted} />
        </>
      ) : null}
    </Screen>
  );
}

/** Pill that opens the restart confirmation; mirrors the InputModeToggle's look. */
function ResetButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Restart puzzle"
      className="bg-surface-muted flex-row items-center gap-2 rounded-full px-3 py-1.5 active:opacity-70"
    >
      <SimpleIcon name="restart" tone="muted" size={16} />
      <Text className="text-ink text-center text-xs font-semibold">Reset</Text>
    </Pressable>
  );
}

/** "Are you sure?" before wiping the current board back to its givens. */
function ResetConfirmOverlay({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="absolute inset-0 items-center justify-center bg-black/50 p-8">
      <View className="border-line bg-surface w-full gap-2 rounded-3xl border p-6">
        <Text className="text-ink text-center text-2xl font-bold">Restart puzzle?</Text>
        <Text className="text-ink-soft text-center">
          This clears every number, note, and your time and mistakes for this puzzle, and starts it
          over. This can't be undone.
        </Text>

        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel="Restart this puzzle"
          className="bg-danger mt-4 flex-row items-center justify-center gap-2 rounded-2xl py-4 active:opacity-80"
        >
          <SimpleIcon name="restart" tone="onPrimary" />
          <Text className="text-on-primary text-lg font-semibold">Restart</Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Keep playing"
          className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl py-3 active:opacity-60"
        >
          <SimpleIcon name="close" tone="muted" />
          <Text className="text-ink-soft text-base font-medium">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function GameHeader({ onBack, onSettings }: { onBack: () => void; onSettings: () => void }) {
  const game = useGameStore((s) => s.game);
  const running = useGameStore((s) => s.running);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);
  const timerEnabled = useSettingsStore((s) => s.settings.timerEnabled);
  const mistakeCheckingEnabled = useSettingsStore((s) => s.settings.mistakeCheckingEnabled);
  const elapsed = useElapsedSeconds();
  const large = useWindowDimensions().width >= 700;

  // Daily puzzles surface their track ("Daily Puzzle"/"Daily Challenge") in place
  // of the raw difficulty, so the player can see they're on the special game.
  const [dailyTrack, setDailyTrack] = useState<DailyTrack | null>(null);
  const gameId = game?.id;
  useEffect(() => {
    if (!gameId) {
      setDailyTrack(null);
      return;
    }
    let cancelled = false;
    getDailyForGame(gameId).then((d) => {
      if (!cancelled) {
        setDailyTrack(d?.track ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (!game) {
    return null;
  }

  // Daily games show "Daily" as the label with "Puzzle"/"Challenge" as the value
  // (single words, so they never wrap); regular games show their difficulty.
  const difficultyLabel =
    dailyTrack === "daily"
      ? "Puzzle"
      : dailyTrack === "challenge"
        ? "Challenge"
        : (DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty);

  return (
    <View className="gap-4">
      {/* Top bar: back · centered title · settings. The flex-1 side zones keep
          the title centered regardless of the two buttons' widths. */}
      <View className="flex-row items-center">
        <View className="flex-1 items-start">
          <NavBackButton onPress={onBack} />
        </View>
        <Text className={clsx("text-ink font-bold", large ? "text-2xl" : "text-lg")}>Sudoku</Text>
        <View className="flex-1 items-end">
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

      {/* Stats as an evenly-spaced label-above-value row: a small uppercase
          label over a bold value, each column centered. tabular-nums keeps the
          timer/mistakes from shifting. */}
      <View className="flex-row">
        <StatItem label={dailyTrack ? "Daily" : "Difficulty"}>
          <Text className={clsx("text-ink text-center font-bold", large ? "text-3xl" : "text-xl")}>
            {difficultyLabel}
          </Text>
        </StatItem>
        {timerEnabled ? (
          <StatItem label="Time">
            <View className="flex-row items-center gap-2">
              <Text
                className={clsx("text-ink font-bold", large ? "text-3xl" : "text-xl")}
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatDuration(elapsed)}
              </Text>
              {/* Always rendered (toggles pause/resume) so the row never reflows. */}
              <Pressable
                onPress={running ? pause : resume}
                accessibilityRole="button"
                accessibilityLabel={running ? "Pause game" : "Resume game"}
                className="bg-surface-muted h-7 w-7 items-center justify-center rounded-full active:opacity-70"
              >
                <SimpleIcon name={running ? "pause" : "play"} tone="muted" size={14} />
              </Pressable>
            </View>
          </StatItem>
        ) : null}
        {mistakeCheckingEnabled ? (
          <StatItem label="Mistakes">
            <Text
              className={clsx(
                "font-bold",
                large ? "text-3xl" : "text-xl",
                game.mistakes > 0 ? "text-danger" : "text-ink",
              )}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {game.mistakes}
            </Text>
          </StatItem>
        ) : null}
      </View>
    </View>
  );
}

/** One game stat: a small uppercase label above its value, centered and
 * equal-width so a row of them is evenly spaced. */
function StatItem({ label, children }: PropsWithChildren<{ label: string }>) {
  const large = useWindowDimensions().width >= 700;
  return (
    <View className="flex-1 items-center gap-0.5">
      <Text
        className={clsx(
          "text-ink-soft font-semibold tracking-widest uppercase",
          large ? "text-sm" : "text-xs",
        )}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function PausedOverlay({ boardSize }: { boardSize: number }) {
  const router = useRouter();
  const resume = useGameStore((s) => s.resume);
  const inset = Math.round(boardSize * 0.04);

  return (
    <View className="absolute inset-0">
      <View className="absolute inset-0 rounded-2xl bg-black/70" />
      <View
        className="border-line bg-surface absolute items-center justify-center gap-3 rounded-3xl border p-6"
        style={{ top: inset, bottom: inset, left: inset, right: inset }}
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
  const hintPromptMode = useGameStore((s) => s.hintPromptMode);
  const confirmHint = useGameStore((s) => s.confirmHint);
  const confirmRewardedHint = useGameStore((s) => s.confirmRewardedHint);
  const dismissHintPrompt = useGameStore((s) => s.dismissHintPrompt);
  const purchaseRemoveAds = useEntitlementStore((s) => s.purchaseRemoveAds);
  const [busy, setBusy] = useState(false);

  if (hintPromptMode === "confirm") {
    return (
      <View className="absolute inset-0 items-center justify-center bg-black/50 p-8">
        <View className="border-line bg-surface w-full gap-2 rounded-3xl border p-6">
          <Text className="text-ink text-center text-2xl font-bold">Need a hint?</Text>
          <Text className="text-ink-soft text-center">
            This will reveal one correct cell. You can undo if you change your mind.
          </Text>

          <Pressable
            onPress={confirmHint}
            accessibilityRole="button"
            accessibilityLabel="Reveal a hint"
            className="bg-primary mt-4 flex-row items-center justify-center gap-2 rounded-2xl py-4 active:opacity-80"
          >
            <SimpleIcon name="hint" tone="onPrimary" />
            <Text className="text-on-primary text-lg font-semibold">Reveal hint</Text>
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
        // Player already asked for a hint — reveal it now that they are premium.
        confirmHint();
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

        {/* Icon pinned left, label centered in the remaining space. */}
        <Pressable
          onPress={onWatch}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Watch ad to reveal a hint"
          className={clsx(
            "mt-4 flex-row items-center rounded-2xl bg-primary px-5 py-4 active:opacity-80",
            busy && "opacity-50",
          )}
        >
          <SimpleIcon name="play" tone="onPrimary" />
          <Text className="text-on-primary flex-1 text-center text-lg font-semibold">
            {busy ? "Loading…" : "Watch Ad"}
          </Text>
        </Pressable>

        {/* Premium upsell — skip hint ads when online. */}
        <Pressable
          onPress={onUpgrade}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Remove ads and skip hint prompts"
          className={clsx(
            "mt-2 flex-row items-center rounded-2xl border border-primary px-5 py-4 active:opacity-80",
            busy && "opacity-50",
          )}
        >
          <SimpleIcon name="plus" tone="primary" />
          <Text className="text-primary flex-1 text-center text-base font-semibold">
            Remove Ads
          </Text>
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

function CompletionOverlay({ justCompleted }: { justCompleted: boolean }) {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const setGame = useGameStore((s) => s.setGame);
  const settings = useSettingsStore((s) => s.settings);
  const [daily, setDaily] = useState<DailyCompletionInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  // Lets the player peek at the solved grid behind the results card; a floating
  // button brings the results back.
  const [viewingBoard, setViewingBoard] = useState(false);

  useEffect(() => {
    if (!game) {
      return;
    }
    let cancelled = false;
    // Always load daily info so the heading, streak, and share text are correct
    // — even when revisiting an already-completed daily from Home.
    getDailyCompletionInfo(game.id).then(async (info) => {
      if (cancelled || !info) {
        return;
      }
      setDaily(info);
      // The one-time celebration side effects (analytics, reminder rescheduling,
      // the reminder opt-in) belong to the actual win, not a later revisit.
      if (!justCompleted) {
        return;
      }
      void track("daily_completed", { track: info.track });
      if (info.track === "daily") {
        // Don't nag about a daily the player just finished — push the reminder
        // out to tomorrow.
        void syncDailyReminderSchedule(useSettingsStore.getState().settings);
      }
      // Finishing a daily/challenge is a high-trust moment: offer the reminder
      // once, here, instead of cold-prompting elsewhere.
      if (!useSettingsStore.getState().settings.dailyReminderEnabled) {
        const [seen, canOffer] = await Promise.all([
          loadReminderPromptSeen(),
          canOfferReminderPrompt(),
        ]);
        if (!cancelled && !seen && canOffer) {
          setShowReminderPrompt(true);
          void setReminderPromptSeen(); // shown once, ever
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [game, justCompleted]);

  const onEnableReminder = async () => {
    setShowReminderPrompt(false);
    const granted = await requestDailyReminderPermission();
    if (granted) {
      useSettingsStore.getState().setSetting("dailyReminderEnabled", true);
      void track("daily_reminder_enabled");
    }
  };

  if (!game) {
    return null;
  }

  const onShare = async () => {
    void track("share_result_tapped", { difficulty: game.difficulty });
    try {
      const result = await Share.share(
        {
          title: "My Sudoku result",
          message: formatShareText({
            difficulty: game.difficulty,
            elapsedSeconds: game.elapsedSeconds,
            mistakes: game.mistakes,
            hintsUsed: game.hintsUsed,
            showTimer: settings.timerEnabled,
            showMistakes: settings.mistakeCheckingEnabled,
            daily: daily
              ? { kind: daily.track, dateKey: daily.dateKey, streak: daily.streak?.current ?? 0 }
              : null,
          }),
        },
        { dialogTitle: "Share your result" },
      );
      // result.action distinguishes a real send from a dismissed share sheet, so
      // we only count completions when the player actually shared.
      if (result.action === Share.sharedAction) {
        void track("share_result_completed", { difficulty: game.difficulty });
      }
    } catch {
      // Share sheet failed to open — nothing actionable for the player.
    }
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

  // Peeking at the completed grid: hide the card (and its dimming scrim) and
  // float a single control to bring the results back.
  if (viewingBoard) {
    return (
      <View className="absolute inset-x-0 bottom-0 items-center p-8">
        <OverlayButton
          icon="trophy"
          label="View Results"
          primary
          onPress={() => setViewingBoard(false)}
          accessibilityLabel="View results"
        />
      </View>
    );
  }

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/50 p-8">
      <View className="border-line bg-surface max-h-full w-full overflow-hidden rounded-3xl border">
        <ScrollView contentContainerClassName="gap-2 p-6" showsVerticalScrollIndicator={false}>
          <Text className="text-center text-4xl">🏆</Text>
          <Text className="text-ink text-center text-2xl font-bold">{heading}</Text>
          <Text className="text-ink-soft text-center">{completionSummary(game, settings)}</Text>
          {daily?.streak && daily.streak.current > 0 ? (
            <Text className="text-warning text-center text-base font-semibold">
              🔥 {daily.streak.current} day streak
            </Text>
          ) : null}

          {showReminderPrompt ? (
            <ReminderPrompt
              onEnable={() => void onEnableReminder()}
              onDismiss={() => setShowReminderPrompt(false)}
            />
          ) : null}

          <OverlayButton
            icon="share"
            label="Share Result"
            primary
            onPress={onShare}
            accessibilityLabel="Share result"
            className="mt-4"
          />
          <OverlayButton
            icon="eye"
            label="View Board"
            onPress={() => setViewingBoard(true)}
            accessibilityLabel="View your completed board"
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
          <NativeAdCard className="mt-4" />
          <RemoveAdsButton source="completion" variant="link" />
        </ScrollView>
      </View>
    </View>
  );
}

/** One-time soft opt-in shown after a daily/challenge win — no OS prompt until
 * the player taps Enable, and never shown again once dismissed. */
function ReminderPrompt({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
  return (
    <View className="border-line bg-canvas mt-4 gap-3 rounded-2xl border p-4">
      <View className="gap-1">
        <Text className="text-ink text-center text-base font-semibold">Want a daily reminder?</Text>
        <Text className="text-ink-soft text-center text-sm">
          A gentle nudge to finish each day's puzzle and keep your streak going.
        </Text>
      </View>
      <Pressable
        onPress={onEnable}
        accessibilityRole="button"
        accessibilityLabel="Turn on daily reminder"
        className="bg-primary items-center rounded-xl py-3 active:opacity-80"
      >
        <Text className="text-on-primary text-base font-semibold">Turn on reminder</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Not now"
        className="items-center py-1 active:opacity-70"
      >
        <Text className="text-ink-soft text-sm font-medium">Not now</Text>
      </Pressable>
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
