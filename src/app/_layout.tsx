import "@/global.css";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initializeApp } from "@/data/init";
import { useDailyReminderObserver } from "@/hooks/useDailyReminderObserver";
import { syncDailyReminderSchedule } from "@/services/notificationService";
import { getSettings } from "@/state/useSettingsStore";
import { Text, View } from "@/tw";

// Web is not a real target for the app: SQLite (`initializeApp` -> `getDatabase`)
// is unsupported there and would crash. The only web surface we serve is the
// DB-free shared-challenge landing page (`/play/*`), so skip the database boot
// and render the navigator straight away. Native still gates on initializeApp.
const SKIP_DB_BOOT = Platform.OS === "web";

export default function RootLayout() {
  const [ready, setReady] = useState(SKIP_DB_BOOT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (SKIP_DB_BOOT) {
      return;
    }
    initializeApp()
      .then(() => setReady(true))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <SafeAreaProvider>
      {ready ? (
        <>
          <Stack screenOptions={{ headerShown: false }} />
          {SKIP_DB_BOOT ? null : <NotificationBridge />}
        </>
      ) : (
        <View className="bg-canvas flex-1 items-center justify-center gap-3">
          {error ? (
            <Text className="text-danger px-8 text-center">{error}</Text>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      )}
    </SafeAreaProvider>
  );
}

/**
 * Renders nothing — it just lives inside the mounted navigator so reminder taps
 * can route, and keeps the daily reminder accurate whenever the app is resumed
 * (a date rollover or a daily finished elsewhere can make a pending reminder
 * stale).
 */
function NotificationBridge() {
  useDailyReminderObserver();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncDailyReminderSchedule(getSettings());
      }
    });
    return () => subscription.remove();
  }, []);

  return null;
}
