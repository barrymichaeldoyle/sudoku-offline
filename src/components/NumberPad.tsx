import { clsx } from "clsx";
import { useMemo } from "react";

import { BOARD_SIZE } from "@/domain/sudoku/types";
import { useGameStore } from "@/state/useGameStore";
import { Pressable, Text, View } from "@/tw";

const NUMBERS = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);

export function NumberPad() {
  const game = useGameStore((s) => s.game);
  const inputMode = useGameStore((s) => s.inputMode);
  const selectedNumber = useGameStore((s) => s.selectedNumber);
  const pressNumber = useGameStore((s) => s.pressNumber);

  const remaining = useMemo(() => {
    const counts = Array.from({ length: BOARD_SIZE + 1 }, () => BOARD_SIZE);
    if (game) {
      for (const value of game.values) {
        if (value != null) {
          counts[value] -= 1;
        }
      }
    }
    return counts;
  }, [game]);

  return (
    <View className="flex-row justify-between gap-1.5">
      {NUMBERS.map((num) => {
        const isSelected = inputMode === "number" && selectedNumber === num;
        const isExhausted = remaining[num] <= 0;
        return (
          <Pressable
            key={num}
            onPress={() => pressNumber(num)}
            accessibilityRole="button"
            accessibilityLabel={`Number ${num}`}
            accessibilityState={{ selected: isSelected }}
            className={clsx(
              "flex-1 items-center justify-center rounded-lg py-3",
              isSelected ? "bg-blue-600" : "bg-neutral-100 dark:bg-neutral-800",
            )}
          >
            <Text
              className={clsx(
                "text-2xl",
                isSelected
                  ? "text-white"
                  : isExhausted
                    ? "text-neutral-300 dark:text-neutral-600"
                    : "text-neutral-900 dark:text-neutral-100",
              )}
            >
              {num}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
