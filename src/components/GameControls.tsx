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
    <View className="gap-2">
      <View className="flex-row gap-2">
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
      {/* Compact, self-sizing input-mode toggle (not flex-1, so it can't
          collapse in this column and get overlapped by the number pad). */}
      <Pressable
        onPress={() => setInputMode(inputMode === "cell" ? "number" : "cell")}
        accessibilityRole="button"
        accessibilityState={{ selected: inputMode === "number" }}
        accessibilityLabel={`Input mode: ${inputMode === "cell" ? "cell first" : "number first"}`}
        className="bg-surface-muted flex-row items-center gap-1.5 self-center rounded-full px-4 py-2 active:opacity-70"
      >
        <Text className="text-ink-dim text-xs font-medium">Input</Text>
        <Text className="text-ink text-xs font-semibold">
          {inputMode === "cell" ? "Cell-first" : "Number-first"}
        </Text>
      </Pressable>
    </View>
  );
}
