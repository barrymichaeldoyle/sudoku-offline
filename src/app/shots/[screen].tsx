import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import {
  buildScreenshotGame,
  SCREENSHOT_GAME_ID,
  SCREENSHOT_MODE,
  SCREENSHOT_SELECTED_CELL,
  seedScreenshotData,
} from "@/data/screenshot/seed";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { View } from "@/tw";

/**
 * Hidden deep-link entry for store-screenshot capture, e.g.
 *
 *   sudokuoffline://shots/game?theme=dark
 *
 * Seeds a fixed app state (see data/screenshot/seed.ts) and lands on the target
 * screen, so a capture script never has to tap through the UI. `screen` is one
 * of home | game | stats; `theme` is light | dark | system. Inert unless the
 * app was built with EXPO_PUBLIC_SCREENSHOT_MODE=1.
 */
export default function Shots() {
  const { screen, theme } = useLocalSearchParams<{ screen?: string; theme?: string }>();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (!SCREENSHOT_MODE || handled.current) {
      return;
    }
    handled.current = true;
    void (async () => {
      // Deterministic default settings (timer + highlights on), onboarding done.
      useSettingsStore.getState().completeOnboarding(false);
      if (theme === "dark" || theme === "light" || theme === "system") {
        useSettingsStore.getState().setSetting("theme", theme);
      }
      await seedScreenshotData();

      if (screen === "game") {
        // Prime the store so the game screen's loadGame() early-returns and the
        // pre-selected center cell (for highlighting) survives the mount.
        useGameStore.getState().setGame(buildScreenshotGame());
        useGameStore.setState({ selectedCell: SCREENSHOT_SELECTED_CELL });
        router.replace({ pathname: "/game/[gameId]", params: { gameId: SCREENSHOT_GAME_ID } });
      } else if (screen === "stats") {
        router.replace("/stats");
      } else {
        router.replace("/");
      }
    })();
  }, [screen, theme, router]);

  if (!SCREENSHOT_MODE) {
    return <Redirect href="/" />;
  }
  return <View className="bg-canvas flex-1" />;
}
