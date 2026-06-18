import type { ComponentProps, ComponentType } from "react";

import { Link as RouterLink } from "expo-router";
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  TouchableHighlight as RNTouchableHighlight,
  TextInput as RNTextInput,
  StyleSheet,
} from "react-native";
import { useCssElement, useNativeVariable as useFunctionalVariable } from "react-native-css";
import Animated from "react-native-reanimated";

// `useCssElement` infers a styled-configuration generic from the component's
// props. For components with very large prop unions (typed-route Link,
// ScrollView, Animated.ScrollView) that inference exceeds TS's union-complexity
// limit (TS2590). Widening the component to ComponentType<any> at the call site
// keeps the public prop types intact while collapsing the internal inference.
type AnyComponent = ComponentType<any>;

// CSS-enabled Link
export const Link = (props: ComponentProps<typeof RouterLink> & { className?: string }) => {
  return useCssElement(RouterLink as AnyComponent, props, { className: "style" });
};

Link.Trigger = RouterLink.Trigger;
Link.Menu = RouterLink.Menu;
Link.MenuAction = RouterLink.MenuAction;
Link.Preview = RouterLink.Preview;

// CSS Variable hook
export const useCSSVariable =
  process.env.EXPO_OS !== "web" ? useFunctionalVariable : (variable: string) => `var(${variable})`;

// View
export type ViewProps = ComponentProps<typeof RNView> & {
  className?: string;
};

export const View = (props: ViewProps) => {
  return useCssElement(RNView as AnyComponent, props, { className: "style" });
};
View.displayName = "CSS(View)";

// Text
export const Text = (props: ComponentProps<typeof RNText> & { className?: string }) => {
  return useCssElement(RNText as AnyComponent, props, { className: "style" });
};
Text.displayName = "CSS(Text)";

// ScrollView
export const ScrollView = (
  props: ComponentProps<typeof RNScrollView> & {
    className?: string;
    contentContainerClassName?: string;
  },
) => {
  return useCssElement(RNScrollView as AnyComponent, props, {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
  });
};
ScrollView.displayName = "CSS(ScrollView)";

// Pressable
export const Pressable = (props: ComponentProps<typeof RNPressable> & { className?: string }) => {
  return useCssElement(RNPressable as AnyComponent, props, { className: "style" });
};
Pressable.displayName = "CSS(Pressable)";

// TextInput
export const TextInput = (props: ComponentProps<typeof RNTextInput> & { className?: string }) => {
  return useCssElement(RNTextInput as AnyComponent, props, { className: "style" });
};
TextInput.displayName = "CSS(TextInput)";

// AnimatedScrollView
export const AnimatedScrollView = (
  props: ComponentProps<typeof Animated.ScrollView> & {
    className?: string;
    contentClassName?: string;
    contentContainerClassName?: string;
  },
) => {
  return useCssElement(Animated.ScrollView as AnyComponent, props, {
    className: "style",
    contentClassName: "contentContainerStyle",
    contentContainerClassName: "contentContainerStyle",
  });
};

// TouchableHighlight with underlayColor extraction
function XXTouchableHighlight(props: ComponentProps<typeof RNTouchableHighlight>) {
  const { underlayColor, ...style } = (StyleSheet.flatten(props.style) ?? {}) as Record<
    string,
    unknown
  >;
  return (
    <RNTouchableHighlight
      underlayColor={underlayColor as string | undefined}
      {...props}
      style={style}
    />
  );
}

export const TouchableHighlight = (
  props: ComponentProps<typeof RNTouchableHighlight> & {
    className?: string;
  },
) => {
  return useCssElement(XXTouchableHighlight as AnyComponent, props, {
    className: "style",
  });
};
TouchableHighlight.displayName = "CSS(TouchableHighlight)";
