import type { View } from "react-native";

import { useEffect, useRef } from "react";
import { AccessibilityInfo, findNodeHandle } from "react-native";

/**
 * Moves VoiceOver or TalkBack focus to a newly presented surface. The target
 * should be a small accessible element, normally the surface heading.
 */
export function useAccessibilityFocus(active = true) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (!enabled || cancelled) {
          return;
        }
        requestAnimationFrame(() => {
          if (cancelled) {
            return;
          }
          const reactTag = findNodeHandle(ref.current);
          if (reactTag != null) {
            AccessibilityInfo.setAccessibilityFocus(reactTag);
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [active]);

  return ref;
}
