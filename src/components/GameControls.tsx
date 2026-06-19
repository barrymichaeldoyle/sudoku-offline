import { clsx } from "clsx";

import { useGameStore } from "@/state/useGameStore";
import { Pressable, Text, View } from "@/tw";

type ControlButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function ControlButton({ label, active, disabled, onPress }: ControlButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      className={clsx(
        "flex-1 items-center justify-center rounded-lg py-3",
        active ? "bg-blue-600" : "bg-neutral-100 dark:bg-neutral-800",
        disabled && "opacity-40",
      )}
    >
      <Text
        className={clsx(
          "text-sm font-medium",
          active ? "text-white" : "text-neutral-700 dark:text-neutral-200",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function GameControls() {
  const inputMode = useGameStore((s) => s.inputMode);
  const notesMode = useGameStore((s) => s.notesMode);
  const canUndo = useGameStore((s) => s.undoStack.length > 0);
  const setInputMode = useGameStore((s) => s.setInputMode);
  const toggleNotesMode = useGameStore((s) => s.toggleNotesMode);
  const erase = useGameStore((s) => s.erase);
  const hint = useGameStore((s) => s.hint);
  const undo = useGameStore((s) => s.undo);

  return (
    <View className="gap-1.5">
      <View className="flex-row gap-1.5">
        <ControlButton label="Undo" disabled={!canUndo} onPress={undo} />
        <ControlButton label="Erase" onPress={erase} />
        <ControlButton
          label={notesMode ? "Notes ✓" : "Notes"}
          active={notesMode}
          onPress={toggleNotesMode}
        />
        <ControlButton label="Hint" onPress={hint} />
      </View>
      <ControlButton
        label={inputMode === "cell" ? "Input: Cell-first" : "Input: Number-first"}
        onPress={() => setInputMode(inputMode === "cell" ? "number" : "cell")}
      />
    </View>
  );
}
