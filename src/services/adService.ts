import { hasRemoveAds } from "@/state/useEntitlementStore";

/**
 * Ad boundary. MVP ships stubs only — no ad SDK — so nothing ever blocks
 * gameplay. Per the product rules, interstitials appear only *after* completion
 * and never for users who own "Remove Ads". Rewarded hints are the integration
 * point for the planned reward-ad features (see docs/retention-monetization.md).
 */
export type AdService = {
  maybeShowPostCompletionInterstitial(): Promise<void>;
  isRewardedHintAvailable(): Promise<boolean>;
  showRewardedHintAd(): Promise<boolean>;
};

export const adService: AdService = {
  async maybeShowPostCompletionInterstitial() {
    if (hasRemoveAds()) {
      return;
    }
    // No ad SDK in MVP — this is where a post-completion interstitial would show.
  },
  async isRewardedHintAvailable() {
    // No ad SDK in MVP.
    return false;
  },
  async showRewardedHintAd() {
    // No ad SDK in MVP — reward never granted.
    return false;
  },
};
