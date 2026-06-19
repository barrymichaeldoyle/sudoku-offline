import type { GameState } from "@/domain/sudoku/types";

import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { ConfettiBurst } from "@/components/ConfettiBurst";
import { setEntitlement } from "@/data/repositories/entitlementRepository";
import { resetStats, seedSampleStats } from "@/data/repositories/statsRepository";
import { ENTITLEMENT_REMOVE_ADS } from "@/domain/entitlements";
import { adService } from "@/services/adService";
import { useEntitlementStore } from "@/state/useEntitlementStore";
import { useGameStore } from "@/state/useGameStore";
import { Pressable, Text, View } from "@/tw";

// A valid solved board, so the previewed success screen renders over a real grid.
const SOLVED = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

const PREVIEW_GAME_ID = "dev-success-preview";

function buildPreviewGame(): GameState {
  const now = new Date().toISOString();
  return {
    id: PREVIEW_GAME_ID,
    puzzleId: "dev-preview",
    difficulty: "hard",
    givens: SOLVED,
    solution: SOLVED,
    values: SOLVED.split("").map(Number),
    notes: Array.from({ length: 81 }, () => 0),
    status: "completed",
    elapsedSeconds: 372,
    mistakes: 1,
    hintsUsed: 2,
    startedAt: now,
    completedAt: now,
    updatedAt: now,
  };
}

/**
 * Dev-only panel (rendered lazily and only when __DEV__) for exercising UI and
 * data states without grinding real games: pop the confetti, preview the success
 * overlay, seed/clear stats, and flip the premium entitlement. Mounted from the
 * Settings screen. None of this ships in release builds.
 */
export default function DevTools() {
  const router = useRouter();
  const [confettiKey, setConfettiKey] = useState(0);
  const isPremium = useEntitlementStore((s) => s.entitlements[ENTITLEMENT_REMOVE_ADS] === true);

  const popConfetti = () => setConfettiKey((k) => k + 1);

  const previewSuccess = () => {
    // Seed a completed game directly; loadGame() early-returns for a matching
    // completed id, so the success overlay stays put when the screen mounts.
    useGameStore.setState({
      game: buildPreviewGame(),
      justCompleted: true,
      selectedCell: null,
      selectedNumber: null,
      notesMode: false,
      undoStack: [],
      hintPromptVisible: false,
      hintPromptMode: null,
      hintCooldownUntil: null,
      running: false,
      lastStartedAt: null,
      loading: false,
    });
    router.push({ pathname: "/game/[gameId]", params: { gameId: PREVIEW_GAME_ID } });
  };

  const seedStats = async () => {
    await seedSampleStats();
    Alert.alert("Stats seeded", "Sample completed games and a 7-day streak were written.");
  };

  const clearStats = async () => {
    await resetStats();
    Alert.alert("Stats cleared", "Completed games and daily streak were wiped.");
  };

  const togglePremium = async () => {
    await setEntitlement(ENTITLEMENT_REMOVE_ADS, !isPremium);
    await useEntitlementStore.getState().hydrate();
  };

  const testRewardedAd = async () => {
    if (!(await adService.isRewardedHintAvailable())) {
      Alert.alert(
        "Rewarded ad",
        "No ad loaded yet — it preloads on launch, so try again in a moment.",
      );
      return;
    }
    const granted = await adService.showRewardedHintAd();
    Alert.alert("Rewarded ad", granted ? "Reward granted ✅" : "Closed without earning a reward.");
  };

  return (
    <View className="gap-3">
      <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
        Developer
      </Text>
      <View className="border-line bg-surface gap-2 rounded-2xl border p-3">
        <DevButton label="Pop confetti 🎉" onPress={popConfetti} />
        <DevButton label="Preview success screen" onPress={previewSuccess} />
        <DevButton label="Test rewarded hint ad" onPress={() => void testRewardedAd()} />
        <DevButton label="Seed sample stats" onPress={() => void seedStats()} />
        <DevButton label="Clear stats" onPress={() => void clearStats()} />
        <DevButton
          label={isPremium ? "Premium: ON — tap to disable" : "Premium: OFF — tap to enable"}
          onPress={() => void togglePremium()}
        />
      </View>
      {confettiKey > 0 ? <ConfettiBurst key={confettiKey} /> : null}
    </View>
  );
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="border-line bg-surface-muted items-center rounded-xl border py-3 active:opacity-80"
    >
      <Text className="text-ink text-base font-medium">{label}</Text>
    </Pressable>
  );
}
