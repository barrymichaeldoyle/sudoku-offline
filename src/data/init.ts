import { adService } from "@/services/adService";
import { track } from "@/services/analyticsService";
import { syncDailyReminderSchedule } from "@/services/notificationService";
import { applyThemePreference } from "@/services/theme";
import { useEntitlementStore } from "@/state/useEntitlementStore";
import { useSettingsStore } from "@/state/useSettingsStore";

import { getDatabase } from "./db/client";
import { reconcileStuckCompletions } from "./repositories/gameRepository";
import { importBundledPacksIfNeeded } from "./repositories/puzzleRepository";

let initPromise: Promise<void> | null = null;

/**
 * Offline-first boot: open the database (running migrations), import bundled
 * puzzle packs once, and hydrate settings. Idempotent and safe to call from
 * multiple places — the work runs a single time per app session.
 */
export function initializeApp(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await getDatabase();
      await importBundledPacksIfNeeded();
      // Heal any completion a lost write left stuck as in-progress (board already
      // solved but status active) before the UI paints, so home never shows a
      // finished puzzle at ~98% and a daily's streak is restored. Best-effort:
      // never block (or fail) boot on it.
      await reconcileStuckCompletions().catch((err: unknown) => {
        console.error("Failed to reconcile stuck completions", err);
      });
      await useSettingsStore.getState().hydrate();
      applyThemePreference(useSettingsStore.getState().settings.theme);
      await useEntitlementStore.getState().hydrate();
      // Keep the daily reminder accurate across launches (date rollover, a daily
      // finished on another day, a reminder time that has since passed).
      void syncDailyReminderSchedule(useSettingsStore.getState().settings);
      // Best-effort: warm the ad SDK so a rewarded hint is ready when asked.
      // Never block (or fail) offline boot on ads.
      void adService.initialize().catch(() => undefined);
      void track("app_opened");
    })().catch((err) => {
      initPromise = null; // allow retry on next call
      throw err;
    });
  }
  return initPromise;
}
