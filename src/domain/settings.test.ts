import { DEFAULT_SETTINGS, MINIMAL_SETTINGS, normalizeSettings } from "./settings";

describe("settings presets", () => {
  it("does not auto-clear notes in the standard preset", () => {
    expect(DEFAULT_SETTINGS.autoNoteCleanup).toBe(false);
  });

  it("keeps box-only note cleanup in the minimal preset", () => {
    expect(MINIMAL_SETTINGS.autoNoteCleanup).toBe(true);
    expect(MINIMAL_SETTINGS.autoNoteCleanupScope).toBe("box");
  });

  it.each([DEFAULT_SETTINGS, MINIMAL_SETTINGS])(
    "keeps player and hint value colors enabled in existing presets",
    (preset) => {
      expect(preset.colorUserValues).toBe(true);
      expect(preset.colorHintValues).toBe(true);
    },
  );
});

describe("normalizeSettings", () => {
  it("returns defaults for null/undefined", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("overlays stored values onto defaults", () => {
    const result = normalizeSettings({ hapticsEnabled: false, theme: "dark" });
    expect(result.hapticsEnabled).toBe(false);
    expect(result.theme).toBe("dark");
    expect(result.timerEnabled).toBe(DEFAULT_SETTINGS.timerEnabled);
  });

  it("defaults new value-color preferences on for existing stored settings", () => {
    const result = normalizeSettings({ timerEnabled: false });
    expect(result.colorUserValues).toBe(true);
    expect(result.colorHintValues).toBe(true);
  });

  it("ignores unknown keys", () => {
    const result = normalizeSettings({ bogus: true } as never);
    expect(result).toEqual(DEFAULT_SETTINGS);
    expect("bogus" in result).toBe(false);
  });

  it("inherits the pre-split combined value for mistake tracking", () => {
    // Settings saved before mistakeTrackingEnabled existed: tracking should
    // follow the old combined mistakeCheckingEnabled choice, not the default.
    expect(normalizeSettings({ mistakeCheckingEnabled: false }).mistakeTrackingEnabled).toBe(false);
    expect(normalizeSettings({ mistakeCheckingEnabled: true }).mistakeTrackingEnabled).toBe(true);
  });

  it("keeps an explicit mistake tracking value independent of checking", () => {
    const result = normalizeSettings({
      mistakeCheckingEnabled: true,
      mistakeTrackingEnabled: false,
    });
    expect(result.mistakeCheckingEnabled).toBe(true);
    expect(result.mistakeTrackingEnabled).toBe(false);
  });
});
