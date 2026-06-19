import type { ThemePreference } from "@/domain/settings";

import { Appearance, type ColorSchemeName } from "react-native";

/**
 * Map a theme preference to the React Native color scheme override:
 * "system" → "unspecified" (follow the OS), otherwise the explicit scheme.
 * `react-native-css` tracks `Appearance`, so this drives the `dark:` style
 * variants reactively.
 */
export function colorSchemeForPreference(pref: ThemePreference): ColorSchemeName {
  return pref === "system" ? "unspecified" : pref;
}

/** Apply a theme preference app-wide. */
export function applyThemePreference(pref: ThemePreference): void {
  Appearance.setColorScheme(colorSchemeForPreference(pref));
}
