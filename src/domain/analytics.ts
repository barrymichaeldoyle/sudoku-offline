/**
 * Local analytics event vocabulary. Events are queued offline only (no backend
 * in MVP); see `services/analyticsService.ts`. Keep names stable — they are the
 * wire format once a sink exists.
 */
export type AnalyticsEventName =
  | "app_opened"
  | "puzzle_started"
  | "puzzle_completed"
  | "puzzle_abandoned"
  | "hint_used"
  | "rewarded_hint_offered"
  | "rewarded_hint_watched"
  | "premium_upgrade_tapped"
  | "daily_started"
  | "daily_completed"
  | "setting_changed"
  | "share_result_tapped";

export type AnalyticsPayload = Record<string, string | number | boolean | null>;
