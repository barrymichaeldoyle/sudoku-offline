import { NavBackButton } from "@/components/NavBackButton";
import { Text, View } from "@/tw";

type ScreenHeaderProps = {
  title: string;
  onBack: () => void;
};

/** Centered title with a chevron back control matching the game screen. */
export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  return (
    <View className="relative flex-row items-center justify-center px-16 pt-1 pb-2">
      <View className="absolute left-4 z-10">
        <NavBackButton onPress={onBack} />
      </View>
      <Text
        accessibilityRole="header"
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.4}
        numberOfLines={1}
        className="text-ink text-lg font-semibold"
      >
        {title}
      </Text>
    </View>
  );
}
