import type { EntitlementMap } from "@/domain/entitlements";

import { getCachedEntitlements } from "@/data/repositories/entitlementRepository";

/**
 * Purchase boundary. MVP ships stubs only — no real store SDK — so gameplay has
 * no network dependency. A real implementation (e.g. RevenueCat / StoreKit /
 * Play Billing) would back `refreshEntitlements`/`purchaseRemoveAds` while the
 * cached entitlements remain the offline source of truth.
 */
export type PurchaseService = {
  getCachedEntitlements(): Promise<EntitlementMap>;
  refreshEntitlements(): Promise<void>;
  purchaseRemoveAds(): Promise<boolean>;
  restorePurchases(): Promise<void>;
};

export const purchaseService: PurchaseService = {
  getCachedEntitlements,
  async refreshEntitlements() {
    // No store SDK in MVP — nothing to refresh from.
  },
  async purchaseRemoveAds() {
    // No store SDK in MVP — purchase cannot be completed.
    return false;
  },
  async restorePurchases() {
    // No store SDK in MVP — nothing to restore.
  },
};
