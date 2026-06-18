import { clsx } from "clsx";

import { useGameStore } from "@/state/useGameStore";
import { Pressable, Text, View } from "@/tw";

type ControlButtonProps = {
  label: string;
  active?: boolean;
  onPress: () => void;
};

function ControlButton({ label, active, onPress }: ControlButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={clsx(
        "flex-1 items-center justify-center rounded-lg py-3",
        active ? "bg-blue-600" : "bg-neutral-100 dark:bg-neutral-800",
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
  const setInputMode = useGameStore((s) => s.setInputMode);
  const toggleNotesMode = useGameStore((s) => s.toggleNotesMode);
  const erase = useGameStore((s) => s.erase);

  return (
    <View className="flex-row gap-1.5">
      <ControlButton
        label={notesMode ? "Notes: On" : "Notes: Off"}
        active={notesMode}
        onPress={toggleNotesMode}
      />
      <ControlButton label="Erase" onPress={erase} />
      <ControlButton
        label={inputMode === "cell" ? "Mode: Cell" : "Mode: Number"}
        onPress={() => setInputMode(inputMode === "cell" ? "number" : "cell")}
      />
    </View>
  );
}
