import { clsx } from "clsx";
import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

import { BOARD_SIZE } from "@/domain/sudoku/types";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, Text, View } from "@/tw";

const NUMBERS = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);

export function NumberPad() {
  const game = useGameStore((s) => s.game);
  const inputMode = useSettingsStore((s) => s.settings.inputMode);
  const selectedNumber = useGameStore((s) => s.selectedNumber);
  const pressNumber = useGameStore((s) => s.pressNumber);
  // Lock the pad once the puzzle is finished so a peek at the board can't edit it.
  const completed = game?.status === "completed";
  const showRemainingCounts = useSettingsStore((s) => s.settings.showRemainingCounts);
  const disableCompletedNumbers = useSettingsStore((s) => s.settings.disableCompletedNumbers);
  const large = useWindowDimensions().width >= 700;

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
        // A digit is "complete" once all nine are placed. Only dim/lock it when
        // the player opted in; otherwise it stays a normal, tappable button.
        const isComplete = left <= 0;
        const locked = completed || (disableCompletedNumbers && isComplete);
        return (
          <Pressable
            key={num}
            onPress={() => pressNumber(num)}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={
              showRemainingCounts ? `Number ${num}, ${left} remaining` : `Number ${num}`
            }
            accessibilityState={{ selected: isSelected, disabled: locked }}
            className={clsx(
              "flex-1 items-center justify-center rounded-xl",
              large
                ? showRemainingCounts
                  ? "py-4"
                  : "py-6"
                : showRemainingCounts
                  ? "py-2"
                  : "py-3.5",
              isSelected ? "bg-primary" : "bg-surface-muted",
              locked && "opacity-40",
            )}
          >
            <Text
              className={clsx(
                "font-semibold leading-tight",
                large ? "text-4xl" : "text-2xl",
                isSelected ? "text-on-primary" : locked ? "text-ink-soft" : "text-ink",
              )}
            >
              {num}
            </Text>
            {showRemainingCounts ? (
              <Text
                className={clsx(
                  "font-semibold leading-none",
                  large ? "text-sm" : "text-[10px]",
                  isSelected ? "text-on-primary" : locked ? "text-ink-dim" : "text-ink-soft",
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
