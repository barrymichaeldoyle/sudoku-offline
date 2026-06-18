import type { ComponentProps, ComponentType } from "react";

import { useCssElement } from "react-native-css";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

/**
 * A CSS-enabled SafeAreaView so screen backgrounds (and theme variants) apply
 * across the safe-area insets. Mirrors the wrappers in src/tw.
 */
export const Screen = (props: ComponentProps<typeof RNSafeAreaView> & { className?: string }) => {
  return useCssElement(RNSafeAreaView as ComponentType<any>, props, { className: "style" });
};

Screen.displayName = "CSS(Screen)";
