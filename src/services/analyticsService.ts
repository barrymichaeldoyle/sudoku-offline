import type { AnalyticsEventName, AnalyticsPayload } from "@/domain/analytics";

import { enqueueEvent } from "@/data/repositories/eventRepository";

/**
 * Record an analytics event in the local offline queue. Fire-and-forget:
 * gameplay never waits on analytics and failures are swallowed so a tracking
 * bug can never affect the user. Callers may `void track(...)`.
 */
export async function track(
  name: AnalyticsEventName,
  payload: AnalyticsPayload = {},
): Promise<void> {
  try {
    await enqueueEvent(name, JSON.stringify(payload));
  } catch {
    // Intentionally ignored — analytics is a side effect, never load-bearing.
  }
}

/**
 * Drain the queue to a remote sink. No-op for MVP (fully offline, no backend):
 * events accumulate locally (capped) until a real sink is wired up, at which
 * point this would batch `getPendingEvents()` → POST → `markEventsSent()`.
 */
export async function flushPendingEvents(): Promise<void> {
  // No backend yet — nothing to flush.
}
