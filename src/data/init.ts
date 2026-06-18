import { useSettingsStore } from "@/state/useSettingsStore";

import { getDatabase } from "./db/client";
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
      await useSettingsStore.getState().hydrate();
    })().catch((err) => {
      initPromise = null; // allow retry on next call
      throw err;
    });
  }
  return initPromise;
}
