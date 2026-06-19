import { clsx } from "clsx";

import { useGameStore } from "@/state/useGameStore";
import { useHintCooldownRemaining } from "@/state/useHintCooldown";
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
        "flex-1 items-center justify-center rounded-xl py-3",
        active ? "bg-primary" : "bg-surface-muted",
        disabled && "opacity-40",
      )}
    >
      <Text className={clsx("text-sm font-semibold", active ? "text-on-primary" : "text-ink-soft")}>
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
  const requestHint = useGameStore((s) => s.requestHint);
  const undo = useGameStore((s) => s.undo);
  const hintCooldown = useHintCooldownRemaining();

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
        <ControlButton
          label={hintCooldown > 0 ? `Hint ${hintCooldown}s` : "Hint"}
          disabled={hintCooldown > 0}
          onPress={requestHint}
        />
      </View>
      <ControlButton
        label={inputMode === "cell" ? "Input: Cell-first" : "Input: Number-first"}
        onPress={() => setInputMode(inputMode === "cell" ? "number" : "cell")}
      />
    </View>
  );
}
