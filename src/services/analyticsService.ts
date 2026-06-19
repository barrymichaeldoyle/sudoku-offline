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
 * Drain the queue to a remote sink — intentionally a no-op.
 *
 * Baseline usage analytics (active users, sessions, platform + app/update
 * version adoption) is handled by EAS Insights (`expo-insights`), which reports
 * automatically from native and needs no code here.
 *
 * EAS Insights does NOT ingest custom events, so the local `track()` queue
 * stays deliberately dormant: events accumulate offline (capped) but are never
 * drained. The flush seam is kept so a custom-event sink (e.g. Aptabase) can be
 * wired later by batching `getPendingEvents()` → POST → `markEventsSent()`.
 */
export async function flushPendingEvents(): Promise<void> {
  // No custom-event sink wired — EAS Insights covers baseline usage instead.
}
