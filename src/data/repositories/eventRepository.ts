import * as Crypto from "expo-crypto";

import { getDatabase } from "../db/client";

/** Hard cap so the offline queue can't grow without bound (no backend drains it). */
const MAX_PENDING = 1000;

export type PendingEvent = {
  id: string;
  eventName: string;
  payloadJson: string;
  createdAt: string;
};

/** Append an event to the local queue, trimming the oldest beyond the cap. */
export async function enqueueEvent(eventName: string, payloadJson: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO pending_events (id, event_name, payload_json, created_at) VALUES (?, ?, ?, ?)",
    Crypto.randomUUID(),
    eventName,
    payloadJson,
    new Date().toISOString(),
  );
  await db.runAsync(
    `DELETE FROM pending_events WHERE id IN (
       SELECT id FROM pending_events ORDER BY created_at DESC LIMIT -1 OFFSET ?
     )`,
    MAX_PENDING,
  );
}

/** Unsent events, oldest first — for a future flush to a real sink. */
export async function getPendingEvents(): Promise<PendingEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    event_name: string;
    payload_json: string;
    created_at: string;
  }>(
    "SELECT id, event_name, payload_json, created_at FROM pending_events WHERE sent_at IS NULL ORDER BY created_at",
  );
  return rows.map((r) => ({
    id: r.id,
    eventName: r.event_name,
    payloadJson: r.payload_json,
    createdAt: r.created_at,
  }));
}

/** Mark events as sent once a real sink confirms delivery. */
export async function markEventsSent(ids: readonly string[], sentAt: string): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const db = await getDatabase();
  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(
    `UPDATE pending_events SET sent_at = ? WHERE id IN (${placeholders})`,
    sentAt,
    ...ids,
  );
}
