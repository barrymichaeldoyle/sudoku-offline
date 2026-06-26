/**
 * Local analytics event vocabulary. These custom events are queued offline only
 * and never sent — EAS Insights (`expo-insights`) covers baseline usage but
 * cannot ingest custom events; see `services/analyticsService.ts`. Keep names
 * stable — they are the wire format once a custom-event sink is wired up.
 */
export type AnalyticsEventName =
  | "app_opened"
  | "puzzle_started"
  | "puzzle_completed"
  | "puzzle_abandoned"
  | "puzzle_restarted"
  | "puzzle_filled_incorrect"
  | "hint_used"
  | "rewarded_hint_offered"
  | "rewarded_hint_watched"
  | "premium_upgrade_tapped"
  | "daily_started"
  | "daily_completed"
  | "setting_changed"
  | "onboarding_completed"
  | "share_result_tapped"
  | "share_result_completed"
  | "challenge_link_opened"
  | "daily_reminder_permission_requested"
  | "daily_reminder_permission_granted"
  | "daily_reminder_permission_denied"
  | "daily_reminder_enabled"
  | "daily_reminder_disabled"
  | "daily_reminder_time_changed"
  | "daily_reminder_scheduled"
  | "daily_reminder_tapped";

export type AnalyticsPayload = Record<string, string | number | boolean | null>;
