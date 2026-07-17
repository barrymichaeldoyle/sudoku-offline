import { AccessibilityInfo } from "react-native";

// Announcements exist for screen-reader users whose feedback would otherwise
// be visual-only (the locked-digit shake, the selection ring moving under
// hardware-keyboard arrows). Track the screen-reader state once, module-wide,
// so callers can fire-and-forget without awaiting a promise per keystroke.
let screenReaderOn = false;

AccessibilityInfo.isScreenReaderEnabled()
  .then((enabled) => {
    screenReaderOn = enabled;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener("screenReaderChanged", (enabled) => {
  screenReaderOn = enabled;
});

/**
 * Speak `message` through VoiceOver/TalkBack. Silent no-op when no screen
 * reader is running, so callers never need to gate themselves.
 */
export function announce(message: string): void {
  if (!screenReaderOn) {
    return;
  }
  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch {
    // Best-effort: never let an announcement break an input path.
  }
}
