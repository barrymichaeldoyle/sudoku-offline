import { SimpleIcon } from "@/components/SimpleIcon";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, Text } from "@/tw";

export function InputModeToggle() {
  const inputMode = useSettingsStore((s) => s.settings.inputMode);
  const setInputMode = useGameStore((s) => s.setInputMode);

  return (
    <Pressable
      onPress={() => setInputMode(inputMode === "cell" ? "number" : "cell")}
      accessibilityRole="button"
      accessibilityState={{ selected: inputMode === "number" }}
      accessibilityLabel={`Input mode: ${inputMode === "cell" ? "cell first" : "number first"}`}
      // Fixed width so the pill doesn't resize between the two labels; the icon
      // sits at the left and the label is centered in the remaining space.
      className="bg-surface-muted w-[120px] flex-row items-center gap-2 rounded-full px-3 py-1.5 active:opacity-70"
    >
      <SimpleIcon name="input" tone="muted" size={16} />
      <Text className="text-ink flex-1 text-center text-xs font-semibold">
        {inputMode === "cell" ? "Cell-first" : "Number-first"}
      </Text>
    </Pressable>
  );
}
