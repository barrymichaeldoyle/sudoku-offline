import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

/**
 * AdMob native ad units, one per placement. Each surface gets its own unit so it
 * reports and optimizes independently in the AdMob console (you can see whether
 * Stats earns its keep separately from the success screen, and pause/tune one
 * without touching the other). iOS and Android use their real units; other
 * platforms fall back to Google's test unit. The card always requests
 * non-personalized ads per the app's policy (no ATT prompt).
 */
export const NATIVE_AD_UNIT_IDS = {
  /** Success screen, shown after completing a puzzle. */
  completion: Platform.select({
    ios: "ca-app-pub-3482457944656598/9438235844",
    android: "ca-app-pub-3482457944656598/7323884412",
    default: TestIds.NATIVE,
  }),
  /** Stats page — a calm, passive browsing surface. */
  stats: Platform.select({
    ios: "ca-app-pub-3482457944656598/9234887999",
    android: "ca-app-pub-3482457944656598/9412514214",
    default: TestIds.NATIVE,
  }),
} as const;
