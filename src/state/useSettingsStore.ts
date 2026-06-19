import { create } from "zustand";

import { loadSettings, saveSettings } from "@/data/repositories/settingsRepository";
import { DEFAULT_SETTINGS, type Settings } from "@/domain/settings";
import { track } from "@/services/analyticsService";

type SettingsStore = {
  settings: Settings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  hydrated: false,

  async hydrate() {
    const settings = await loadSettings();
    set({ settings, hydrated: true });
  },

  setSetting(key, value) {
    const settings = { ...get().settings, [key]: value };
    set({ settings });
    void saveSettings(settings).catch(() => {});
    void track("setting_changed", { setting: String(key), value });
  },
}));

/** Non-reactive read for use outside React (e.g. the haptics helper). */
export function getSettings(): Settings {
  return useSettingsStore.getState().settings;
}
