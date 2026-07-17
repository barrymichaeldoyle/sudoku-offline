import type { CellValue, NoteMask } from "@/domain/sudoku/types";

import { clsx } from "clsx";
import { memo, useEffect, useRef } from "react";
import {
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { getColIndex, getRowIndex } from "@/domain/sudoku/board";
import { hasNote } from "@/domain/sudoku/notes";
import { Pressable, Text, View } from "@/tw";
import { Animated } from "@/tw/animated";

import { numberColor } from "./cell-color";

// Scale-up bounce when a value appears (or changes); a quick shrink on the way
// out. Keyed by value so replacing one digit with another re-triggers it.
const VALUE_ENTER = new Keyframe({
  0: { transform: [{ scale: 0.3 }], opacity: 0 },
  60: { transform: [{ scale: 1.15 }], opacity: 1 },
  100: { transform: [{ scale: 1 }], opacity: 1 },
})
  .duration(220)
  .reduceMotion(ReduceMotion.System);

const VALUE_EXIT = new Keyframe({
  0: { transform: [{ scale: 1 }], opacity: 1 },
  100: { transform: [{ scale: 0.3 }], opacity: 0 },
})
  .duration(140)
  .reduceMotion(ReduceMotion.System);

// Notes get a subtler, quicker pop than values — there are up to nine per cell
// and they toggle often, so a small fade-and-scale keeps it from feeling busy.
const NOTE_ENTER = new Keyframe({
  0: { transform: [{ scale: 0.5 }], opacity: 0 },
  100: { transform: [{ scale: 1 }], opacity: 1 },
})
  .duration(140)
  .reduceMotion(ReduceMotion.System);

const NOTE_EXIT = new Keyframe({
  0: { transform: [{ scale: 1 }], opacity: 1 },
  100: { transform: [{ scale: 0.5 }], opacity: 0 },
})
  .duration(110)
  .reduceMotion(ReduceMotion.System);

type SudokuCellProps = {
  index: number;
  value: CellValue;
  notes: NoteMask;
  isGiven: boolean;
  isHint: boolean;
  colorUserValues: boolean;
  colorHintValues: boolean;
  isSelected: boolean;
  isPeer: boolean;
  isSameValue: boolean;
  isConflict: boolean;
  /**
   * Set (to the flash nonce) while this cell's digit is being shake-rejected
   * on the number pad, so the on-board copies of the digit shake along with
   * the pad button — the pad alone is easy to miss. Null when not flashing.
   */
  flashNonce: number | null;
  onPress: (index: number) => void;
  // Pixel font sizes scaled to the cell; when omitted, fixed Tailwind sizes are
  // used (board renders at its container width with no measured size).
  fontSize?: number;
  noteFontSize?: number;
};

const NOTE_NUMBERS = Array.from({ length: 9 }, (_, i) => i + 1);

// Cell background follows the state priority from the design guidelines.
// Givens are intentionally NOT shaded (traditional Sudoku leaves them on the
// plain cell); they're distinguished from user entries by font weight + colour.
function background({
  isConflict,
  isSelected,
  isSameValue,
  isPeer,
}: Pick<SudokuCellProps, "isConflict" | "isSelected" | "isSameValue" | "isPeer">): string {
  if (isConflict) return "bg-cell-error";
  if (isSelected) return "bg-cell-selected";
  if (isSameValue) return "bg-cell-same";
  if (isPeer) return "bg-cell-peer";
  return "bg-cell";
}

// Number colour. The selected cell's fill is bright (gold/amber) in both themes,
// so givens use a fixed dark ink; user entries keep a deeper blue so the
// player can still tell their own number apart from a clue while it's selected.
// Errors always read in the error colour.
function SudokuCellComponent(props: SudokuCellProps) {
  const { index, value, notes, isGiven, isHint, isSelected, onPress, fontSize, noteFontSize } =
    props;
  const row = getRowIndex(index);
  const col = getColIndex(index);
  // Skip the entrance animation for values present on first render (givens and
  // a resumed game) so the board doesn't bounce every digit in on load. Only
  // changes made after mount animate.
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Same side-to-side "no" shake as the pad button, driven imperatively so it
  // can't disturb the value's keyed enter/exit animations with a remount.
  const shakeX = useSharedValue(0);
  useEffect(() => {
    if (props.flashNonce == null) {
      return;
    }
    const step = (toValue: number) =>
      withTiming(toValue, { duration: 56, reduceMotion: ReduceMotion.System });
    shakeX.value = withSequence(step(-5), step(5), step(-4), step(2), step(0));
  }, [props.flashNonce, shakeX]);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));
  const a11yLabel =
    `Row ${row + 1}, column ${col + 1}` +
    (value != null
      ? `, ${value}${isGiven ? " given" : isHint ? " revealed hint, locked" : ""}`
      : ", empty");

  return (
    <Pressable
      onPress={() => onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: isSelected }}
      className={clsx(
        "flex-1 items-center justify-center",
        // An error cell keeps its red fill even while selected (error outranks
        // selection for the background), so selection is shown as a gold ring
        // instead — otherwise the selected cell is indistinguishable from any
        // other mistake and the player loses track of it.
        isSelected && props.isConflict
          ? "border-2 border-cell-selected"
          : "border-[0.5px] border-grid-minor",
        // The thicker 3x3 box boundaries are drawn as a single overlay layer in
        // SudokuBoard so the major lines always sit on top of the lighter cell
        // lines, rather than relying on per-cell border paint order.
        background(props),
      )}
    >
      {value != null ? (
        <Animated.View
          key={value}
          entering={hasMounted.current ? VALUE_ENTER : undefined}
          exiting={VALUE_EXIT}
          style={shakeStyle}
          className="items-center justify-center"
        >
          <Text
            style={fontSize != null ? { fontSize } : undefined}
            className={clsx(
              fontSize == null && "text-2xl",
              // Bold clues anchor the puzzle; the player's own entries sit a
              // step lighter so they read as distinct from the givens.
              isGiven || isHint || props.isConflict ? "font-bold" : "font-medium",
              numberColor(props),
            )}
          >
            {value}
          </Text>
        </Animated.View>
      ) : notes ? (
        <View className="h-full w-full flex-row flex-wrap p-[1px]">
          {NOTE_NUMBERS.map((n) => (
            <View key={n} className="h-1/3 w-1/3 items-center justify-center">
              {hasNote(notes, n) ? (
                <Animated.View
                  entering={hasMounted.current ? NOTE_ENTER : undefined}
                  exiting={NOTE_EXIT}
                >
                  <Text
                    style={noteFontSize != null ? { fontSize: noteFontSize } : undefined}
                    className={clsx(
                      noteFontSize == null && "text-[9px]",
                      "font-medium leading-none",
                      isSelected ? "text-cell-selected-ink" : "text-num-note",
                    )}
                  >
                    {n}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export const SudokuCell = memo(SudokuCellComponent);
