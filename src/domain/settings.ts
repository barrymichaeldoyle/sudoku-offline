export type ThemePreference = "system" | "light" | "dark";

export type Settings = {
  theme: ThemePreference;
  timerEnabled: boolean;
  mistakeCheckingEnabled: boolean;
  highlightSameNumbers: boolean;
  highlightPeers: boolean;
  hapticsEnabled: boolean;
  autoNoteCleanup: boolean;
  /** Show how many of each digit remain to place, under the number pad. */
  showRemainingCounts: boolean;
  /** Premium-only: skip the hint confirmation dialog. */
  instantHintsEnabled: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  timerEnabled: true,
  mistakeCheckingEnabled: true,
  highlightSameNumbers: true,
  highlightPeers: true,
  hapticsEnabled: true,
  autoNoteCleanup: true,
  showRemainingCounts: true,
  instantHintsEnabled: false,
};

/**
 * First-launch "minimal" preset: a distraction-free board. Every assist is off
 * except haptics (and theme stays on system). Picked from the onboarding screen.
 */
export const MINIMAL_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  timerEnabled: false,
  mistakeCheckingEnabled: false,
  highlightSameNumbers: false,
  highlightPeers: false,
  autoNoteCleanup: false,
  showRemainingCounts: false,
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
