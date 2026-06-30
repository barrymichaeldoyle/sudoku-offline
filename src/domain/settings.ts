export type ThemePreference = "system" | "light" | "dark";

/** Board input style: pick a cell then a number, or a number then cells. */
export type InputMode = "cell" | "number";

/**
 * Which pencil notes auto-clear removes when a digit is placed:
 * - "all": every peer sharing a row, column, or box (standard sudoku).
 * - "box": only the same 3x3 box.
 */
export type NoteCleanupScope = "all" | "box";

export type Settings = {
  theme: ThemePreference;
  /** Cell-first vs number-first board input; shared by the in-game toggle. */
  inputMode: InputMode;
  timerEnabled: boolean;
  /** Flag wrong numbers as you place them (red highlight + invalid haptic). */
  mistakeCheckingEnabled: boolean;
  /** Count mistakes and surface them in the game HUD, stats, and shares. */
  mistakeTrackingEnabled: boolean;
  highlightSameNumbers: boolean;
  highlightPeers: boolean;
  hapticsEnabled: boolean;
  autoNoteCleanup: boolean;
  /** Scope of auto-clear notes; only applies when `autoNoteCleanup` is on. */
  autoNoteCleanupScope: NoteCleanupScope;
  /**
   * Cell-first only: after penciling a note, tapping a peer cell (same row,
   * column, or box) auto-adds that same note, so candidates can be swept in.
   */
  autoCarryNotes: boolean;
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
  inputMode: "cell",
  timerEnabled: true,
  mistakeCheckingEnabled: true,
  mistakeTrackingEnabled: true,
  highlightSameNumbers: true,
  highlightPeers: true,
  hapticsEnabled: true,
  autoNoteCleanup: true,
  autoNoteCleanupScope: "all",
  autoCarryNotes: true,
  // Off by default (incl. the full-experience preset): the under-pad counts are
  // too noisy for the average player. Available as an opt-in toggle in Settings.
  showRemainingCounts: false,
  disableCompletedNumbers: true,
  instantHintsEnabled: false,
  dailyReminderEnabled: false,
  dailyReminderTimeMinutes: DEFAULT_REMINDER_TIME_MINUTES,
};

/**
 * First-launch "minimal" preset: a distraction-free board. Every assist is off
 * except haptics (and theme stays on system) — plus auto-clear notes, which is
 * pure bookkeeping players expect rather than a visual aid. Its scope is kept to
 * the 3x3 box here, matching the lighter-touch feel of the minimal preset.
 * Picked from the onboarding screen.
 */
export const MINIMAL_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  timerEnabled: false,
  mistakeCheckingEnabled: false,
  mistakeTrackingEnabled: false,
  highlightSameNumbers: false,
  highlightPeers: false,
  showRemainingCounts: false,
  disableCompletedNumbers: false,
  autoNoteCleanupScope: "box",
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
  // `mistakeTrackingEnabled` was split out of the old combined
  // `mistakeCheckingEnabled`. For settings saved before the split, inherit the
  // player's previous combined choice so behaviour is preserved on upgrade.
  if (stored.mistakeTrackingEnabled === undefined && stored.mistakeCheckingEnabled !== undefined) {
    result.mistakeTrackingEnabled = stored.mistakeCheckingEnabled;
  }
  return result;
}
