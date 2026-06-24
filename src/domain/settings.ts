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
  /** Grey out and lock a number-pad digit once all nine are placed. */
  disableCompletedNumbers: boolean;
  /** Premium-only: skip the hint confirmation dialog. */
  instantHintsEnabled: boolean;
  /** Opt-in local reminder to come back for today's unfinished Daily Puzzle. */
  dailyReminderEnabled: boolean;
  /** Reminder time as minutes after local midnight (default 09:00 = 540). */
  dailyReminderTimeMinutes: number;
};

/** Default reminder time: 09:00 local, expressed as minutes after midnight. */
export const DEFAULT_REMINDER_TIME_MINUTES = 9 * 60;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  timerEnabled: true,
  mistakeCheckingEnabled: true,
  highlightSameNumbers: true,
  highlightPeers: true,
  hapticsEnabled: true,
  autoNoteCleanup: true,
  showRemainingCounts: true,
  disableCompletedNumbers: true,
  instantHintsEnabled: false,
  dailyReminderEnabled: false,
  dailyReminderTimeMinutes: DEFAULT_REMINDER_TIME_MINUTES,
};

/**
 * First-launch "minimal" preset: a distraction-free board. Every assist is off
 * except haptics (and theme stays on system) — plus auto-clear notes, which is
 * pure bookkeeping players expect rather than a visual aid. Picked from the
 * onboarding screen.
 */
export const MINIMAL_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  timerEnabled: false,
  mistakeCheckingEnabled: false,
  highlightSameNumbers: false,
  highlightPeers: false,
  showRemainingCounts: false,
  disableCompletedNumbers: false,
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
