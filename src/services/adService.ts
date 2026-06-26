import { Platform } from "react-native";
import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

/**
 * Ad boundary, backed by Google AdMob (react-native-google-mobile-ads). Product
 * principle: **no intrusive ads during play** — no interstitials, nothing that
 * blocks the board during or between puzzles. Non-intrusive native ads are fine
 * on non-gameplay surfaces (e.g. the success screen), and *rewarded* ads are
 * opt-in unlocks the player chooses for a clear benefit (extra hint, and the
 * planned streak-restore / challenge-unlock features). Premium ("Remove Ads")
 * removes the native ads and gets the rewarded perks free; for rewarded hints
 * the game store short-circuits with hasRemoveAds() before reaching here.
 *
 * iOS uses the real AdMob rewarded-hint unit. Android stays on Google's test
 * unit until the Android AdMob app and ad units exist. The web build uses
 * adService.web.ts, which stubs all of this out. See docs/retention-monetization.md.
 */
export type AdService = {
  /** Initialize the SDK and warm a rewarded ad. Safe to call once at boot. */
  initialize(): Promise<void>;
  isRewardedHintAvailable(): Promise<boolean>;
  showRewardedHintAd(): Promise<boolean>;
};

const REWARDED_HINT_AD_UNIT_ID = Platform.select({
  ios: "ca-app-pub-3482457944656598/5403777597",
  default: TestIds.REWARDED,
});

/**
 * Devices that should be served Google *test* ads from our **real** ad units —
 * the safe, account-policy-compliant way to see the ad flow on a real device or
 * TestFlight build (you must never tap your own live ads). Set
 * `EXPO_PUBLIC_AD_TEST_DEVICE_IDS` to a comma-separated list of device hashes;
 * absent/empty in production builds, so real users are unaffected. The
 * simulator's built-in `EMULATOR` id is always included in dev so local runs
 * get fills too.
 *
 * To find a device's hash, run a build, trigger an ad, and read the device log
 * line: "To get test ads on this device, set ... testDeviceIdentifiers = @[ ... ]".
 */
function testDeviceIdentifiers(): string[] {
  const fromEnv = (process.env.EXPO_PUBLIC_AD_TEST_DEVICE_IDS ?? "")
    .split(",")
    .map((id: string) => id.trim())
    .filter(Boolean);
  return __DEV__ ? ["EMULATOR", ...fromEnv] : fromEnv;
}

let sdkReady: Promise<void> | null = null;
/** The currently loaded/loading rewarded ad and its listener cleanups. */
let pending: { ad: RewardedAd; cleanup: () => void } | null = null;
let isLoaded = false;

function ensureSdk(): Promise<void> {
  if (!sdkReady) {
    sdkReady = (async () => {
      const ids = testDeviceIdentifiers();
      if (ids.length > 0) {
        // Must be set before initialize() so the very first request honours it.
        await mobileAds().setRequestConfiguration({ testDeviceIdentifiers: ids });
      }
      await mobileAds().initialize();
    })();
  }
  return sdkReady;
}

/** Create and load a fresh rewarded ad, ready for the next request. */
function preload(): void {
  if (pending) {
    return;
  }
  const ad = RewardedAd.createForAdRequest(REWARDED_HINT_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  });
  const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    isLoaded = true;
  });
  const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
    teardown();
  });
  pending = {
    ad,
    cleanup: () => {
      unsubLoaded();
      unsubError();
    },
  };
  ad.load();
}

/** Drop the current ad and its listeners; the next request re-preloads. */
function teardown(): void {
  pending?.cleanup();
  pending = null;
  isLoaded = false;
}

export const adService: AdService = {
  async initialize() {
    await ensureSdk();
    preload();
  },

  async isRewardedHintAvailable() {
    await ensureSdk();
    if (!pending) {
      preload();
    }
    return isLoaded;
  },

  async showRewardedHintAd() {
    await ensureSdk();
    if (!pending || !isLoaded) {
      // Nothing ready — start loading one for next time and report failure.
      preload();
      return false;
    }
    const { ad } = pending;
    return new Promise<boolean>((resolve) => {
      let earned = false;
      const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      const finish = (granted: boolean) => {
        unsubEarned();
        unsubClosed();
        unsubError();
        teardown();
        preload(); // get the next ad ready
        resolve(granted);
      };
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned));
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
      try {
        ad.show();
      } catch {
        finish(false);
      }
    });
  },
};
