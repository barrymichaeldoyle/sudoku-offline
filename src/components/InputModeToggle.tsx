import { SimpleIcon } from "@/components/SimpleIcon";
import { useGameStore } from "@/state/useGameStore";
import { Pressable, Text } from "@/tw";

export function InputModeToggle() {
  const inputMode = useGameStore((s) => s.inputMode);
  const setInputMode = useGameStore((s) => s.setInputMode);

  return (
    <Pressable
      onPress={() => setInputMode(inputMode === "cell" ? "number" : "cell")}
      accessibilityRole="button"
      accessibilityState={{ selected: inputMode === "number" }}
      accessibilityLabel={`Input mode: ${inputMode === "cell" ? "cell first" : "number first"}`}
      className="bg-surface-muted flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
    >
      <SimpleIcon name="input" tone="muted" size={16} />
      <Text className="text-ink text-xs font-semibold">
        {inputMode === "cell" ? "Cell-first" : "Number-first"}
      </Text>
    </Pressable>
  );
}
