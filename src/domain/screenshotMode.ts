/**
 * True only in builds made with `EXPO_PUBLIC_SCREENSHOT_MODE=1`. Hidden store
 * screenshot routes and presentation overrides must stay behind this flag.
 */
export const SCREENSHOT_MODE = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === "1";
