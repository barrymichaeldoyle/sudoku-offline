import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";

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
