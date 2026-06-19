import type { Settings, ThemePreference } from "@/domain/settings";

import { useRouter } from "expo-router";
import { Alert, Switch } from "react-native";

import { Screen } from "@/components/Screen";
import { resetStats } from "@/data/repositories/statsRepository";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, ScrollView, Text, View } from "@/tw";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type ToggleKey = Exclude<keyof Settings, "theme">;

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "timerEnabled", label: "Timer", hint: "Show the elapsed-time clock" },
  {
    key: "mistakeCheckingEnabled",
    label: "Mistake checking",
    hint: "Flag wrong numbers as you play",
  },
  {
    key: "highlightPeers",
    label: "Highlight peers",
    hint: "Shade the selected row, column, and box",
  },
  {
    key: "highlightSameNumbers",
    label: "Highlight same numbers",
    hint: "Shade cells matching the selected value",
  },
  {
    key: "autoNoteCleanup",
    label: "Auto-clear notes",
    hint: "Remove notes a placed number rules out",
  },
  { key: "hapticsEnabled", label: "Haptics", hint: "Vibration feedback on actions" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.setSetting);

  const onResetStats = () => {
    Alert.alert("Reset stats?", "This permanently clears your completed games and daily streak.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => void resetStats() },
    ]);
  };

  return (
    <Screen className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-row items-center px-4 pt-2">
        <Pressable
          onPress={() => router.back()}
          className="py-1 pr-4"
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Text className="text-base text-blue-600 dark:text-blue-400">‹ Home</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Settings
        </Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="gap-3">
          <Text className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
            Theme
          </Text>
          <View className="flex-row gap-2">
            {THEME_OPTIONS.map((opt) => {
              const active = settings.theme === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setSetting("theme", opt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.label} theme`}
                  className={
                    active
                      ? "flex-1 items-center rounded-xl bg-blue-600 py-3"
                      : "flex-1 items-center rounded-xl bg-neutral-100 py-3 dark:bg-neutral-800"
                  }
                >
                  <Text
                    className={
                      active
                        ? "font-semibold text-white"
                        : "font-medium text-neutral-900 dark:text-neutral-100"
                    }
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
            Gameplay
          </Text>
          {TOGGLES.map((t) => (
            <View
              key={t.key}
              className="flex-row items-center justify-between gap-3 rounded-xl bg-neutral-100 px-4 py-3 dark:bg-neutral-800"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                  {t.label}
                </Text>
                <Text className="text-sm text-neutral-500">{t.hint}</Text>
              </View>
              <Switch
                value={settings[t.key]}
                onValueChange={(v) => setSetting(t.key, v)}
                accessibilityLabel={t.label}
              />
            </View>
          ))}
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium tracking-wide text-neutral-500 uppercase">Data</Text>
          <Pressable
            onPress={onResetStats}
            accessibilityRole="button"
            accessibilityLabel="Reset stats"
            className="items-center rounded-xl bg-red-50 py-4 dark:bg-red-950"
          >
            <Text className="text-base font-medium text-red-600 dark:text-red-400">
              Reset Stats
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
