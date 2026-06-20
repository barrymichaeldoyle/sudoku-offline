/** Cached premium entitlements, keyed by id. Read offline; refreshed best-effort. */
export type EntitlementMap = Record<string, boolean>;

/** The one-time "Remove Ads" purchase. */
export const ENTITLEMENT_REMOVE_ADS = "remove_ads";

/**
 * Master switch for the in-app-purchase surface ("Remove Ads" CTA, the
 * settings Ads & Purchases section, Restore Purchases). Backed by the real
 * `expo-iap` implementation in `purchaseService.ts` (StoreKit 2 / Play Billing).
 * The `remove_ads` non-consumable must exist and be approved in App Store Connect
 * (id `REMOVE_ADS_PRODUCT_ID`) before this surface works in production.
 * See docs/APP_STORE_LAUNCH.md.
 */
export const IAP_ENABLED = true;
