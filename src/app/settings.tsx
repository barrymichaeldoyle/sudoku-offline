import type { Settings, ThemePreference } from "@/domain/settings";

import { useRouter } from "expo-router";
import { Alert, Switch } from "react-native";

import { RemoveAdsButton } from "@/components/RemoveAdsButton";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { resetStats } from "@/data/repositories/statsRepository";
import { ENTITLEMENT_REMOVE_ADS } from "@/domain/entitlements";
import { useEntitlementStore } from "@/state/useEntitlementStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, ScrollView, Text, View } from "@/tw";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type ToggleKey = Exclude<keyof Settings, "theme">;

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  {
    key: "timerEnabled",
    label: "Timer",
    hint: "Track elapsed time, pause/resume, and time stats",
  },
  {
    key: "mistakeCheckingEnabled",
    label: "Mistake checking",
    hint: "Flag wrong numbers and track mistakes in stats",
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
  const isPremium = useEntitlementStore((s) => s.entitlements[ENTITLEMENT_REMOVE_ADS] === true);
  const restorePurchases = useEntitlementStore((s) => s.restorePurchases);

  const onResetStats = () => {
    Alert.alert("Reset stats?", "This permanently clears your completed games and daily streak.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => void resetStats() },
    ]);
  };

  const onRestore = async () => {
    await restorePurchases();
    const restored = useEntitlementStore.getState().entitlements[ENTITLEMENT_REMOVE_ADS] === true;
    Alert.alert(
      restored ? "Purchases restored" : "Nothing to restore",
      restored
        ? "Ads are removed. Thanks for your support."
        : "We couldn’t find a previous purchase to restore.",
    );
  };

  return (
    <Screen className="bg-canvas flex-1">
      <ScreenHeader title="Settings" onBack={() => router.back()} />

      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="gap-3">
          <Text className="text-ink-dim px-1 text-xs font-semibold tracking-widest uppercase">
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
                      ? "bg-primary flex-1 items-center rounded-xl py-3"
                      : "border-line bg-surface flex-1 items-center rounded-xl border py-3"
                  }
                >
                  <Text
                    className={active ? "text-on-primary font-semibold" : "text-ink font-medium"}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-ink-dim px-1 text-xs font-semibold tracking-widest uppercase">
            Gameplay
          </Text>
          {TOGGLES.map((t) => (
            <View
              key={t.key}
              className="border-line bg-surface flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-ink text-base font-medium">{t.label}</Text>
                <Text className="text-ink-soft text-sm">{t.hint}</Text>
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
          <Text className="text-ink-dim px-1 text-xs font-semibold tracking-widest uppercase">
            Ads & Purchases
          </Text>
          {isPremium ? (
            <View className="gap-3">
              <View className="border-line bg-surface gap-0.5 rounded-2xl border px-4 py-3">
                <Text className="text-ink text-base font-medium">Premium active</Text>
                <Text className="text-ink-soft text-sm">
                  No ads. Hints without prompts. Thanks for your support.
                </Text>
              </View>
              <View className="border-line bg-surface flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3">
                <View className="flex-1 gap-0.5">
                  <Text className="text-ink text-base font-medium">Instant hints</Text>
                  <Text className="text-ink-soft text-sm">
                    Reveal hints immediately without a confirmation prompt
                  </Text>
                </View>
                <Switch
                  value={settings.instantHintsEnabled}
                  onValueChange={(v) => setSetting("instantHintsEnabled", v)}
                  accessibilityLabel="Instant hints"
                />
              </View>
            </View>
          ) : (
            <>
              <RemoveAdsButton source="settings" />
              <Text className="text-ink-soft text-sm">
                One-time purchase. Skip rewarded-ad prompts for hints. No ads ever appear while you
                play.
              </Text>
            </>
          )}
          <Pressable
            onPress={onRestore}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            className="border-line bg-surface items-center rounded-2xl border py-4 active:opacity-80"
          >
            <Text className="text-ink text-base font-medium">Restore Purchases</Text>
          </Pressable>
        </View>

        <View className="gap-3">
          <Text className="text-ink-dim px-1 text-xs font-semibold tracking-widest uppercase">
            Data
          </Text>
          <Pressable
            onPress={onResetStats}
            accessibilityRole="button"
            accessibilityLabel="Reset stats"
            className="border-danger items-center rounded-2xl border py-4 active:opacity-80"
          >
            <Text className="text-danger text-base font-medium">Reset Stats</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
