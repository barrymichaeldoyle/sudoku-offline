import type { AdService } from "./adService";

/**
 * Web stub. react-native-google-mobile-ads is native-only, so on web there are
 * no ads — rewarded hints are simply never available. Premium users skip ads
 * regardless. Metro resolves this file in place of adService.ts for web.
 */
export const adService: AdService = {
  async initialize() {
    // No ad SDK on web.
  },
  async isRewardedHintAvailable() {
    return false;
  },
  async showRewardedHintAd() {
    return false;
  },
};
