import { create } from "zustand";

import {
  loadOnboardingComplete,
  loadSettings,
  saveSettings,
  setOnboardingComplete,
} from "@/data/repositories/settingsRepository";
import { DEFAULT_SETTINGS, MINIMAL_SETTINGS, type Settings } from "@/domain/settings";
import { track } from "@/services/analyticsService";
import { syncDailyReminderSchedule } from "@/services/notificationService";
import { applyThemePreference } from "@/services/theme";

type SettingsStore = {
  settings: Settings;
  hydrated: boolean;
  /** Whether the first-launch onboarding has been completed. */
  onboardingComplete: boolean;
  hydrate: () => Promise<void>;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  /** Apply the chosen first-launch preset (minimal vs full) and mark it done. */
  completeOnboarding: (minimal: boolean) => void;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  hydrated: false,
  onboardingComplete: false,

  async hydrate() {
    const [settings, onboardingComplete] = await Promise.all([
      loadSettings(),
      loadOnboardingComplete(),
    ]);
    set({ settings, onboardingComplete, hydrated: true });
  },

  setSetting(key, value) {
    const settings = { ...get().settings, [key]: value };
    set({ settings });
    if (key === "theme") {
      applyThemePreference(settings.theme);
    }
    if (key === "dailyReminderEnabled" || key === "dailyReminderTimeMinutes") {
      void syncDailyReminderSchedule(settings);
    }
    void saveSettings(settings).catch(() => {});
    void track("setting_changed", { setting: String(key), value });
  },

  completeOnboarding(minimal) {
    const settings = { ...(minimal ? MINIMAL_SETTINGS : DEFAULT_SETTINGS) };
    set({ settings, onboardingComplete: true });
    applyThemePreference(settings.theme);
    void saveSettings(settings).catch(() => {});
    void setOnboardingComplete().catch(() => {});
    void track("onboarding_completed", { minimal });
  },
}));

/** Non-reactive read for use outside React (e.g. the haptics helper). */
export function getSettings(): Settings {
  return useSettingsStore.getState().settings;
}
