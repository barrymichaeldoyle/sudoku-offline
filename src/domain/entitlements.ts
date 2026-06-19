/** Cached premium entitlements, keyed by id. Read offline; refreshed best-effort. */
export type EntitlementMap = Record<string, boolean>;

/** The one-time "Remove Ads" purchase. */
export const ENTITLEMENT_REMOVE_ADS = "remove_ads";

/**
 * Master switch for the in-app-purchase surface ("Remove Ads" CTA, the
 * settings Ads & Purchases section, Restore Purchases). Disabled for the v1.0
 * App Store launch because `purchaseService` is still a stub — shipping a
 * non-functional purchase button is an App Store rejection (Guideline 2.1).
 * Flip to `true` once a real StoreKit/RevenueCat implementation lands.
 * See docs/APP_STORE_LAUNCH.md.
 */
export const IAP_ENABLED = false;
