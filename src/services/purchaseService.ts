import {
  ErrorCode,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  type Purchase,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases as restoreNativePurchases,
} from "expo-iap";

import { getCachedEntitlements, setEntitlement } from "@/data/repositories/entitlementRepository";
import { ENTITLEMENT_REMOVE_ADS, type EntitlementMap } from "@/domain/entitlements";

/**
 * App Store / Play Store product id for the one-time, non-consumable "Remove
 * Ads" purchase. Must match the product configured in App Store Connect (and the
 * Play Console when Android ships). Distinct from the local entitlement key
 * (`ENTITLEMENT_REMOVE_ADS`) we cache in SQLite — this is the *store* id.
 */
export const REMOVE_ADS_PRODUCT_ID = "com.barrymichaeldoyle.sudokuoffline.remove_ads";

/** Give up on a purchase that never resolves (e.g. the modal was dismissed by the OS). */
const PURCHASE_TIMEOUT_MS = 120_000;

/**
 * Purchase boundary, backed by `expo-iap` (StoreKit 2 on iOS, Play Billing on
 * Android). Cached entitlements in SQLite remain the offline source of truth;
 * this service reconciles them with the store on purchase / restore / refresh.
 *
 * `requestPurchase` is *event-based* — the outcome arrives via the
 * `purchaseUpdatedListener` / `purchaseErrorListener`, never the return value —
 * so we keep one set of listeners alive for the session and resolve the in-flight
 * purchase promise from there. The web build uses `purchaseService.web.ts`, which
 * stubs all of this out (no native store SDK in the browser).
 */
export type PurchaseService = {
  getCachedEntitlements(): Promise<EntitlementMap>;
  refreshEntitlements(): Promise<void>;
  purchaseRemoveAds(): Promise<boolean>;
  restorePurchases(): Promise<void>;
};

let connection: Promise<void> | null = null;
/** Resolver for the purchase currently awaiting a store callback, if any. */
let pendingPurchaseResolve: ((ok: boolean) => void) | null = null;

/** Finish the transaction (clears the store queue) and cache the entitlement. */
async function grant(purchase: Purchase): Promise<void> {
  await finishTransaction({ purchase, isConsumable: false });
  await setEntitlement(ENTITLEMENT_REMOVE_ADS, true);
}

/**
 * Connect to the store once per session and wire the purchase listeners. The
 * update listener also handles StoreKit replaying unfinished transactions on
 * connect, so an interrupted purchase is still granted on next launch.
 */
function ensureConnected(): Promise<void> {
  if (!connection) {
    connection = (async () => {
      purchaseUpdatedListener(async (purchase) => {
        if (purchase.productId !== REMOVE_ADS_PRODUCT_ID) {
          return;
        }
        // 'pending' is a deferred purchase (e.g. Ask to Buy) — wait for the next update.
        if (purchase.purchaseState === "pending") {
          return;
        }
        try {
          await grant(purchase);
          pendingPurchaseResolve?.(true);
        } catch {
          pendingPurchaseResolve?.(false);
        }
      });
      purchaseErrorListener((error) => {
        if (error.code !== ErrorCode.UserCancelled) {
          console.warn("[purchase] error", error.code, error.message);
        }
        pendingPurchaseResolve?.(false);
      });
      await initConnection();
    })();
  }
  return connection;
}

export const purchaseService: PurchaseService = {
  getCachedEntitlements,

  async refreshEntitlements() {
    await ensureConnected();
    const purchases = await getAvailablePurchases();
    if (purchases.some((p) => p.productId === REMOVE_ADS_PRODUCT_ID)) {
      await setEntitlement(ENTITLEMENT_REMOVE_ADS, true);
    }
  },

  async purchaseRemoveAds() {
    await ensureConnected();
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        pendingPurchaseResolve = null;
        clearTimeout(timer);
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), PURCHASE_TIMEOUT_MS);
      pendingPurchaseResolve = done;
      requestPurchase({
        request: {
          apple: { sku: REMOVE_ADS_PRODUCT_ID },
          google: { skus: [REMOVE_ADS_PRODUCT_ID] },
        },
        type: "in-app",
      }).catch(() => done(false));
    });
  },

  async restorePurchases() {
    await ensureConnected();
    try {
      await restoreNativePurchases();
    } catch {
      // Best-effort sync; fall through to reading what the store has on file.
    }
    const purchases = await getAvailablePurchases();
    const owned = purchases.find((p) => p.productId === REMOVE_ADS_PRODUCT_ID);
    if (owned) {
      await grant(owned);
    }
  },
};
