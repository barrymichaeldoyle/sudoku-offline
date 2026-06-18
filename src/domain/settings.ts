export type ThemePreference = "system" | "light" | "dark";

export type Settings = {
  theme: ThemePreference;
  timerEnabled: boolean;
  mistakeCheckingEnabled: boolean;
  highlightSameNumbers: boolean;
  highlightPeers: boolean;
  hapticsEnabled: boolean;
  autoNoteCleanup: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  timerEnabled: true,
  mistakeCheckingEnabled: true,
  highlightSameNumbers: true,
  highlightPeers: true,
  hapticsEnabled: true,
  autoNoteCleanup: true,
};

/**
 * Merge persisted values onto the defaults, dropping unknown keys. Keeps a
 * stored settings blob forward/backward compatible as the shape evolves.
 */
export function normalizeSettings(stored: Partial<Settings> | null | undefined): Settings {
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }
  const result = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = stored[key];
    if (value !== undefined) {
      // @ts-expect-error indexed assignment across the union is safe per-key
      result[key] = value;
    }
  }
  return result;
}
