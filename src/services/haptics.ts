import * as Haptics from "expo-haptics";

import { getSettings } from "@/state/useSettingsStore";

// Haptics are best-effort: gated by the user setting and never allowed to throw
// (e.g. on web or unsupported devices).
function run(fn: () => Promise<unknown>): void {
  if (!getSettings().hapticsEnabled) {
    return;
  }
  try {
    void fn().catch(() => {});
  } catch {
    // ignore
  }
}

export const haptics = {
  place(): void {
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  invalid(): void {
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  complete(): void {
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  toggle(): void {
    run(() => Haptics.selectionAsync());
  },
};
