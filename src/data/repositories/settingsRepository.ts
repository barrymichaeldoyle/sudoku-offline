import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "@/domain/settings";

import { getDatabase } from "../db/client";

// All settings are stored under a single JSON blob keyed in the settings table.
const SETTINGS_KEY = "app_settings";

export async function loadSettings(): Promise<Settings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    SETTINGS_KEY,
  );
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    return normalizeSettings(JSON.parse(row.value) as Partial<Settings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    SETTINGS_KEY,
    JSON.stringify(settings),
  );
}

// Whether the first-launch onboarding (minimal vs full) has been completed.
const ONBOARDING_KEY = "onboarding_complete";

export async function loadOnboardingComplete(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ONBOARDING_KEY,
  );
  return row?.value === "true";
}

export async function setOnboardingComplete(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ONBOARDING_KEY,
    "true",
  );
}
