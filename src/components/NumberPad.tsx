import { clsx } from "clsx";
import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { Keyframe, ReduceMotion } from "react-native-reanimated";

import { isDigitCompleted } from "@/domain/sudoku/board";
import { BOARD_SIZE } from "@/domain/sudoku/types";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, Text, View } from "@/tw";
import { Animated } from "@/tw/animated";

const NUMBERS = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);

// Quick side-to-side "no" shake for a locked button whose digit was typed on a
// hardware keyboard — the rejection needs to be visible, not silent.
const LOCKED_SHAKE = new Keyframe({
  0: { transform: [{ translateX: 0 }] },
  20: { transform: [{ translateX: -5 }] },
  40: { transform: [{ translateX: 5 }] },
  60: { transform: [{ translateX: -4 }] },
  80: { transform: [{ translateX: 2 }] },
  100: { transform: [{ translateX: 0 }] },
})
  .duration(280)
  .reduceMotion(ReduceMotion.System);

export function NumberPad() {
  const game = useGameStore((s) => s.game);
  const inputMode = useSettingsStore((s) => s.settings.inputMode);
  const selectedNumber = useGameStore((s) => s.selectedNumber);
  const pressNumber = useGameStore((s) => s.pressNumber);
  const lockedFlash = useGameStore((s) => s.lockedDigitFlash);
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

  // Completion is structural (nine copies, no shared row/col/box), not just a
  // count of nine: an over-placed digit with duplicates must stay unlocked or
  // it can never be entered in the box that still needs it.
  const completedDigits = useMemo(
    () => NUMBERS.map((num) => (game ? isDigitCompleted(game.values, num) : false)),
    [game],
  );

  return (
    <View className="flex-row justify-between gap-1.5">
      {NUMBERS.map((num) => {
        const isSelected = inputMode === "number" && selectedNumber === num;
        const left = Math.max(0, remaining[num]);
        // Only dim/lock a completed digit when the player opted in; otherwise
        // it stays a normal, tappable button.
        const isComplete = completedDigits[num - 1];
        const locked = completed || (disableCompletedNumbers && isComplete);
        const isFlashing = lockedFlash?.digit === num;
        return (
          <View key={num} className="flex-1">
            {/* Remounting on the flash nonce replays the entering shake, so
                every rejected keystroke shakes again — even the same digit
                twice in a row. */}
            <Animated.View
              key={isFlashing ? `flash-${lockedFlash.nonce}` : "static"}
              entering={isFlashing ? LOCKED_SHAKE : undefined}
            >
              <Pressable
                onPress={() => pressNumber(num)}
                disabled={locked}
                accessibilityRole="button"
                accessibilityLabel={
                  showRemainingCounts ? `Number ${num}, ${left} remaining` : `Number ${num}`
                }
                accessibilityState={{ selected: isSelected, disabled: locked }}
                className={clsx(
                  "items-center justify-center rounded-xl",
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
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}
