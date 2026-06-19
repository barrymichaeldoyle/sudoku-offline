import type { EntitlementMap } from "@/domain/entitlements";

import { getDatabase } from "../db/client";

/** All cached entitlements as a key→boolean map (the offline source of truth). */
export async function getCachedEntitlements(): Promise<EntitlementMap> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM entitlements",
  );
  const map: EntitlementMap = {};
  for (const row of rows) {
    map[row.key] = row.value === "true";
  }
  return map;
}

/** Cache an entitlement's state, with optional verification/expiry timestamps. */
export async function setEntitlement(
  key: string,
  value: boolean,
  opts: { verifiedAt?: string | null; expiresAt?: string | null } = {},
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO entitlements (key, value, verified_at, expires_at) VALUES (?, ?, ?, ?)",
    key,
    value ? "true" : "false",
    opts.verifiedAt ?? new Date().toISOString(),
    opts.expiresAt ?? null,
  );
}
