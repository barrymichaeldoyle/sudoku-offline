import "@/global.css";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initializeApp } from "@/data/init";
import { Text, View } from "@/tw";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp()
      .then(() => setReady(true))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <SafeAreaProvider>
      {ready ? (
        <Stack screenOptions={{ headerShown: false }} />
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
