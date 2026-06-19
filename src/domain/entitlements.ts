/** Cached premium entitlements, keyed by id. Read offline; refreshed best-effort. */
export type EntitlementMap = Record<string, boolean>;

/** The one-time "Remove Ads" purchase. */
export const ENTITLEMENT_REMOVE_ADS = "remove_ads";
