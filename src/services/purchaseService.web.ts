import type { PurchaseService } from "./purchaseService";

import { getCachedEntitlements } from "@/data/repositories/entitlementRepository";

/** Re-exported so web callers can import the product id without pulling in expo-iap. */
export const REMOVE_ADS_PRODUCT_ID = "com.barrymichaeldoyle.sudokuoffline.remove_ads";

/**
 * Web has no native store SDK, so purchases are inert here. Cached entitlements
 * (SQLite) still hydrate and read normally; there's just nothing to buy/restore.
 * Metro resolves this in place of purchaseService.ts for the web build.
 */
export const purchaseService: PurchaseService = {
  getCachedEntitlements,
  async refreshEntitlements() {
    // No store SDK on web — nothing to refresh from.
  },
  async purchaseRemoveAds() {
    // No store SDK on web — purchase cannot be completed.
    return false;
  },
  async restorePurchases() {
    // No store SDK on web — nothing to restore.
  },
};
