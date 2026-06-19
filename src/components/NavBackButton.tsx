import { SimpleIcon } from "@/components/SimpleIcon";
import { Pressable } from "@/tw";

/** Chevron-only back control — matches the game screen header. */
export function NavBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className="-ml-1 h-10 w-10 items-center justify-center active:opacity-60"
    >
      <SimpleIcon name="back" tone="primary" size={22} />
    </Pressable>
  );
}
