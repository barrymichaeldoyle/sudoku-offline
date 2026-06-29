/**
 * Web stub for the ad unit ids. The native file imports
 * `react-native-google-mobile-ads` (for `TestIds`), whose import chain reaches
 * RN internals that aren't supported on web and break the static export. Ads
 * never render on web (NativeAdCard.web is a no-op that ignores `unitId`), so
 * these are inert placeholders that exist only to satisfy the shared import.
 */
export const NATIVE_AD_UNIT_IDS = {
  completion: "",
  stats: "",
} as const;
