import { clsx } from "clsx";
import { useMemo } from "react";

import { BOARD_SIZE } from "@/domain/sudoku/types";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, Text, View } from "@/tw";

const NUMBERS = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);

export function NumberPad() {
  const game = useGameStore((s) => s.game);
  const inputMode = useGameStore((s) => s.inputMode);
  const selectedNumber = useGameStore((s) => s.selectedNumber);
  const pressNumber = useGameStore((s) => s.pressNumber);
  const showRemainingCounts = useSettingsStore((s) => s.settings.showRemainingCounts);

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
        const left = Math.max(0, remaining[num]);
        const isExhausted = left <= 0;
        return (
          <Pressable
            key={num}
            onPress={() => pressNumber(num)}
            accessibilityRole="button"
            accessibilityLabel={
              showRemainingCounts ? `Number ${num}, ${left} remaining` : `Number ${num}`
            }
            accessibilityState={{ selected: isSelected, disabled: isExhausted }}
            className={clsx(
              "flex-1 items-center justify-center rounded-xl",
              showRemainingCounts ? "py-2" : "py-3.5",
              isSelected ? "bg-primary" : "bg-surface-muted",
            )}
          >
            <Text
              className={clsx(
                "text-2xl font-semibold leading-tight",
                isSelected ? "text-on-primary" : isExhausted ? "text-ink-soft" : "text-ink",
              )}
            >
              {num}
            </Text>
            {showRemainingCounts ? (
              <Text
                className={clsx(
                  "text-[10px] font-semibold leading-none",
                  isSelected ? "text-on-primary" : isExhausted ? "text-ink-dim" : "text-ink-soft",
                )}
              >
                {left}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
