import type { ComponentProps, ComponentType } from "react";

import { Image as RNImage } from "expo-image";
import { StyleSheet } from "react-native";
import { useCssElement } from "react-native-css";
import Animated from "react-native-reanimated";

const AnimatedExpoImage = Animated.createAnimatedComponent(RNImage);

export type ImageProps = ComponentProps<typeof Image>;

function CSSImage(props: ComponentProps<typeof AnimatedExpoImage>) {
  // @ts-expect-error: Remap objectFit style to contentFit property
  const { objectFit, objectPosition, ...style } = StyleSheet.flatten(props.style) || {};

  return (
    <AnimatedExpoImage
      contentFit={objectFit}
      contentPosition={objectPosition}
      {...props}
      source={typeof props.source === "string" ? { uri: props.source } : props.source}
      // @ts-expect-error: Style is remapped above
      style={style}
    />
  );
}

export const Image = (props: ComponentProps<typeof CSSImage> & { className?: string }) => {
  return useCssElement(CSSImage as ComponentType<any>, props, { className: "style" });
};

Image.displayName = "CSS(Image)";
