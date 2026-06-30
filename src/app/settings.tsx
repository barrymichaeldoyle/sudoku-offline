import type { InputMode, NoteCleanupScope, Settings, ThemePreference } from "@/domain/settings";

import { useRouter } from "expo-router";
import { lazy, Suspense } from "react";
import { Alert, Platform, Switch } from "react-native";

import { RemoveAdsButton } from "@/components/RemoveAdsButton";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { resetStats } from "@/data/repositories/statsRepository";
import { ENTITLEMENT_REMOVE_ADS, IAP_ENABLED } from "@/domain/entitlements";
import { formatReminderTime } from "@/domain/reminder";
import { track } from "@/services/analyticsService";
import { requestDailyReminderPermission } from "@/services/notificationService";
import { useEntitlementStore } from "@/state/useEntitlementStore";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, ScrollView, Text, View } from "@/tw";

// Dev-only tools, lazily loaded so they stay out of release bundles' hot path.
const DevTools = __DEV__ ? lazy(() => import("@/components/DevTools")) : null;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const INPUT_MODE_OPTIONS: { value: InputMode; label: string }[] = [
  { value: "cell", label: "Cell-first" },
  { value: "number", label: "Number-first" },
];

type ToggleKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  {
    key: "timerEnabled",
    label: "Timer",
    hint: "Track elapsed time, pause/resume, and time stats",
  },
  {
    key: "mistakeCheckingEnabled",
    label: "Mistake checking",
    hint: "Flag wrong numbers in red as you place them",
  },
  {
    key: "mistakeTrackingEnabled",
    label: "Mistake counter",
    hint: "Count your mistakes and show them in stats",
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
  {
    key: "autoCarryNotes",
    label: "Carry notes",
    hint: "Cell-first: repeat a note onto an aligned cell in the same box",
  },
  {
    key: "showRemainingCounts",
    label: "Remaining counts",
    hint: "Show how many of each number are left under the number pad",
  },
  {
    key: "disableCompletedNumbers",
    label: "Disable completed numbers",
    hint: "Grey out and lock a number once all nine are placed",
  },
  { key: "hapticsEnabled", label: "Haptics", hint: "Vibration feedback on actions" },
];

const CLEANUP_SCOPE_OPTIONS: { value: NoteCleanupScope; label: string; hint: string }[] = [
  {
    value: "all",
    label: "Row, column & box",
    hint: "Clear every cell the number rules out (standard)",
  },
  { value: "box", label: "Box only", hint: "Clear notes only within the same 3x3 box" },
];

// A few sensible reminder times (minutes after local midnight). Kept to presets
// so we don't need a native time-picker dependency for v1.
const REMINDER_TIMES = [8 * 60, 9 * 60, 12 * 60, 18 * 60, 20 * 60];

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.setSetting);
  // Routed through the game store so the live board's selection state is cleared
  // alongside persisting the choice — same entry point as the in-game toggle.
  const setInputMode = useGameStore((s) => s.setInputMode);
  const isPremium = useEntitlementStore((s) => s.entitlements[ENTITLEMENT_REMOVE_ADS] === true);
  const restorePurchases = useEntitlementStore((s) => s.restorePurchases);

  const onToggleReminder = async (next: boolean) => {
    if (!next) {
      setSetting("dailyReminderEnabled", false);
      void track("daily_reminder_disabled");
      return;
    }
    const granted = await requestDailyReminderPermission();
    if (!granted) {
      // Permission denied — keep the app-level setting off and point the player
      // at system settings (we don't re-ask automatically).
      Alert.alert(
        "Notifications are off",
        "To get a daily reminder, enable notifications for Sudoku in your device settings.",
      );
      return;
    }
    setSetting("dailyReminderEnabled", true);
    void track("daily_reminder_enabled");
  };

  const onChangeReminderTime = (minutes: number) => {
    setSetting("dailyReminderTimeMinutes", minutes);
    void track("daily_reminder_time_changed", { minutes });
  };

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

      <ScrollView contentContainerClassName="p-6">
        <View className="w-full max-w-[640px] gap-6 self-center">
          <View className="gap-3">
            <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
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
            <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
              Gameplay
            </Text>
            <View className="border-line bg-surface gap-3 rounded-2xl border px-4 py-3">
              <View className="gap-0.5">
                <Text className="text-ink text-base font-medium">Input mode</Text>
                <Text className="text-ink-soft text-sm">
                  {settings.inputMode === "cell"
                    ? "Tap a cell, then a number to fill it."
                    : "Tap a number, then the cells to place it in."}
                </Text>
              </View>
              <View className="flex-row gap-2">
                {INPUT_MODE_OPTIONS.map((opt) => {
                  const active = settings.inputMode === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setInputMode(opt.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${opt.label} input`}
                      className={
                        active
                          ? "bg-primary flex-1 rounded-xl px-3 py-2.5"
                          : "border-line bg-canvas flex-1 rounded-xl border px-3 py-2.5"
                      }
                    >
                      <Text
                        className={
                          active
                            ? "text-on-primary text-center text-sm font-semibold"
                            : "text-ink text-center text-sm font-medium"
                        }
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {TOGGLES.map((t) => (
              <View
                key={t.key}
                className="border-line bg-surface gap-3 rounded-2xl border px-4 py-3"
              >
                <View className="flex-row items-center justify-between gap-3">
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
                {t.key === "autoNoteCleanup" && settings.autoNoteCleanup ? (
                  <View className="flex-row gap-2">
                    {CLEANUP_SCOPE_OPTIONS.map((opt) => {
                      const active = settings.autoNoteCleanupScope === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setSetting("autoNoteCleanupScope", opt.value)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`Auto-clear scope: ${opt.label}`}
                          accessibilityHint={opt.hint}
                          className={
                            active
                              ? "bg-primary flex-1 rounded-xl px-3 py-2.5"
                              : "border-line bg-canvas flex-1 rounded-xl border px-3 py-2.5"
                          }
                        >
                          <Text
                            className={
                              active
                                ? "text-on-primary text-center text-sm font-semibold"
                                : "text-ink text-center text-sm font-medium"
                            }
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          {Platform.OS === "web" ? null : (
            <View className="gap-3">
              <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
                Reminders
              </Text>
              <View className="border-line bg-surface flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3">
                <View className="flex-1 gap-0.5">
                  <Text className="text-ink text-base font-medium">Daily puzzle reminder</Text>
                  <Text className="text-ink-soft text-sm">
                    A gentle nudge to finish today's Daily Puzzle and keep your streak going
                  </Text>
                </View>
                <Switch
                  value={settings.dailyReminderEnabled}
                  onValueChange={(v) => void onToggleReminder(v)}
                  accessibilityLabel="Daily puzzle reminder"
                />
              </View>
              {settings.dailyReminderEnabled ? (
                <View className="border-line bg-surface gap-3 rounded-2xl border px-4 py-3">
                  <Text className="text-ink text-base font-medium">Reminder time</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {REMINDER_TIMES.map((minutes) => {
                      const active = settings.dailyReminderTimeMinutes === minutes;
                      const label = formatReminderTime(minutes);
                      return (
                        <Pressable
                          key={minutes}
                          onPress={() => onChangeReminderTime(minutes)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`Remind me at ${label}`}
                          className={
                            active
                              ? "bg-primary rounded-xl px-4 py-2.5"
                              : "border-line bg-canvas rounded-xl border px-4 py-2.5"
                          }
                        >
                          <Text
                            className={
                              active ? "text-on-primary font-semibold" : "text-ink font-medium"
                            }
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {IAP_ENABLED ? (
            <View className="gap-3">
              <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
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
                    One-time purchase. Skip rewarded-ad prompts for hints. No ads ever appear while
                    you play.
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
          ) : null}

          <View className="gap-3">
            <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
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

          {DevTools ? (
            <Suspense fallback={null}>
              <DevTools />
            </Suspense>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
