import { clsx } from "clsx";
import { useWindowDimensions } from "react-native";

import { SimpleIcon, type SimpleIconName } from "@/components/SimpleIcon";
import { useGameStore } from "@/state/useGameStore";
import { useHintCooldownRemaining } from "@/state/useHintCooldown";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, Text, View } from "@/tw";

type ControlButtonProps = {
  label: string;
  icon: SimpleIconName;
  active?: boolean;
  /** Shows a tick badge in the top-right corner without affecting layout. */
  checked?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function ControlButton({ label, icon, active, checked, disabled, onPress }: ControlButtonProps) {
  const large = useWindowDimensions().width >= 700;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active || !!checked }}
      className={clsx(
        "flex-1 items-center justify-center rounded-xl",
        large ? "gap-1 py-5" : "py-3",
        active ? "bg-primary" : "bg-surface-muted",
        disabled && "opacity-40",
      )}
    >
      <SimpleIcon name={icon} tone={active ? "onPrimary" : "muted"} size={large ? 30 : undefined} />
      <Text
        className={clsx(
          "font-semibold",
          large ? "text-base" : "text-sm",
          active ? "text-on-primary" : "text-ink-soft",
        )}
      >
        {label}
      </Text>
      {/* Absolutely positioned so toggling it never shifts the icon/label. */}
      {checked ? (
        <View className="absolute top-1 right-1.5">
          <Text className={clsx("text-xs font-bold", active ? "text-on-primary" : "text-primary")}>
            ✓
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function GameControls() {
  const inputMode = useSettingsStore((s) => s.settings.inputMode);
  const eraseArmed = useGameStore((s) => s.eraseArmed);
  const notesMode = useGameStore((s) => s.notesMode);
  const canUndo = useGameStore((s) => s.undoStack.length > 0);
  const canRedo = useGameStore((s) => s.redoStack.length > 0);
  // A finished board is read-only, so its edit tools are locked while the
  // player reviews it (Reset stays available on the board itself).
  const completed = useGameStore((s) => s.game?.status === "completed");
  const toggleNotesMode = useGameStore((s) => s.toggleNotesMode);
  const erase = useGameStore((s) => s.erase);
  const requestHint = useGameStore((s) => s.requestHint);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const hintCooldown = useHintCooldownRemaining();

  return (
    <View className="flex-row gap-2">
      <ControlButton label="Undo" icon="undo" disabled={completed || !canUndo} onPress={undo} />
      <ControlButton label="Redo" icon="redo" disabled={completed || !canRedo} onPress={redo} />
      <ControlButton
        label="Erase"
        icon="erase"
        active={inputMode === "number" && eraseArmed}
        disabled={completed}
        onPress={erase}
      />
      <ControlButton
        label="Notes"
        icon="notes"
        active={notesMode}
        checked={notesMode}
        disabled={completed}
        onPress={toggleNotesMode}
      />
      <ControlButton
        label={hintCooldown > 0 ? `Hint ${hintCooldown}s` : "Hint"}
        icon="hint"
        disabled={completed || hintCooldown > 0}
        onPress={requestHint}
      />
    </View>
  );
}
