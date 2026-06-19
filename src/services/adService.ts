/**
 * Ad boundary. MVP ships stubs only — no ad SDK. By product decision there are
 * **no forced ads**: no interstitials, no banners, nothing during or between
 * puzzles. The only ads are user-initiated *rewarded* ads (extra hint, and the
 * planned streak-restore / challenge-unlock features) — the player always opts
 * in for a clear benefit. Premium ("Remove Ads") users skip these entirely and
 * get the perks for free. See docs/retention-monetization.md and docs/ASO.md.
 */
export type AdService = {
  isRewardedHintAvailable(): Promise<boolean>;
  showRewardedHintAd(): Promise<boolean>;
};

export const adService: AdService = {
  async isRewardedHintAvailable() {
    // No ad SDK in MVP.
    return false;
  },
  async showRewardedHintAd() {
    // No ad SDK in MVP — reward never granted.
    return false;
  },
};
