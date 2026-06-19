import { clsx } from "clsx";

import { SimpleIcon, type SimpleIconName } from "@/components/SimpleIcon";
import { useGameStore } from "@/state/useGameStore";
import { useHintCooldownRemaining } from "@/state/useHintCooldown";
import { Pressable, Text, View } from "@/tw";

type ControlButtonProps = {
  label: string;
  icon: SimpleIconName;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function ControlButton({ label, icon, active, disabled, onPress }: ControlButtonProps) {
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
      <SimpleIcon name={icon} tone={active ? "onPrimary" : "muted"} />
      <Text className={clsx("text-sm font-semibold", active ? "text-on-primary" : "text-ink-soft")}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GameControls() {
  const notesMode = useGameStore((s) => s.notesMode);
  const canUndo = useGameStore((s) => s.undoStack.length > 0);
  const toggleNotesMode = useGameStore((s) => s.toggleNotesMode);
  const erase = useGameStore((s) => s.erase);
  const requestHint = useGameStore((s) => s.requestHint);
  const undo = useGameStore((s) => s.undo);
  const hintCooldown = useHintCooldownRemaining();

  return (
    <View className="flex-row gap-2">
      <ControlButton label="Undo" icon="undo" disabled={!canUndo} onPress={undo} />
      <ControlButton label="Erase" icon="erase" onPress={erase} />
      <ControlButton
        label={notesMode ? "Notes ✓" : "Notes"}
        icon="notes"
        active={notesMode}
        onPress={toggleNotesMode}
      />
      <ControlButton
        label={hintCooldown > 0 ? `Hint ${hintCooldown}s` : "Hint"}
        icon="hint"
        disabled={hintCooldown > 0}
        onPress={requestHint}
      />
    </View>
  );
}
