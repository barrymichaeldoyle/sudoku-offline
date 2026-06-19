import { create } from "zustand";

import { getCachedEntitlements } from "@/data/repositories/entitlementRepository";
import { ENTITLEMENT_REMOVE_ADS, type EntitlementMap } from "@/domain/entitlements";
import { purchaseService } from "@/services/purchaseService";

type EntitlementStore = {
  entitlements: EntitlementMap;
  hydrated: boolean;
  /** Load cached entitlements from SQLite (offline source of truth). */
  hydrate: () => Promise<void>;
  /** Best-effort refresh from the store SDK, then re-read the cache. No-op in MVP. */
  refresh: () => Promise<void>;
};

export const useEntitlementStore = create<EntitlementStore>((set) => ({
  entitlements: {},
  hydrated: false,

  async hydrate() {
    const entitlements = await getCachedEntitlements();
    set({ entitlements, hydrated: true });
  },

  async refresh() {
    await purchaseService.refreshEntitlements();
    set({ entitlements: await getCachedEntitlements() });
  },
}));

/** Non-reactive check for use outside React (e.g. the ad service). */
export function hasRemoveAds(): boolean {
  return useEntitlementStore.getState().entitlements[ENTITLEMENT_REMOVE_ADS] === true;
}
