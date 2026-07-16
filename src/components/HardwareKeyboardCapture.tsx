import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { Platform, TextInput, type TextInputKeyPressEvent } from "react-native";

import { BOARD_SIZE } from "@/domain/sudoku/types";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";

/**
 * Invisible, always-focused input that turns hardware-keyboard keystrokes into
 * game actions, for anyone playing with an external keyboard (iPad keyboards,
 * the simulator with "Connect Hardware Keyboard" on):
 *
 *   1-9        enter the digit (same path as the number pad, so notes mode and
 *              number-first input behave exactly like tapping the pad)
 *   0 / ⌫ / e  erase (cell-first) or arm the erase tool (number-first)
 *   n          toggle notes mode
 *   u / r      undo / redo
 *
 * iOS only: Android never delivers hardware keystrokes through onKeyPress.
 * The soft keyboard stays hidden (showSoftInputOnFocus={false}), so touch
 * players never see this input exists. The game screen mounts it only while
 * the board is editable — never under the pause/reset/hint/completion
 * overlays, which keyboard input would otherwise bypass.
 */
export function HardwareKeyboardCapture() {
  const inputRef = useRef<TextInput>(null);
  // Distinguishes our own deliberate blur (screen lost focus) from focus being
  // stolen by something else, which we recover from by refocusing.
  const holdFocus = useRef(false);

  useFocusEffect(
    useCallback(() => {
      holdFocus.current = true;
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => {
        holdFocus.current = false;
        clearTimeout(id);
        inputRef.current?.blur();
      };
    }, []),
  );

  const onKeyPress = (e: TextInputKeyPressEvent) => {
    const key = e.nativeEvent.key;
    // Typed characters accumulate in the (invisible) field; drop them so
    // there's never text for iOS to spell-check or suggest against.
    inputRef.current?.clear();

    if (key >= "1" && key <= "9") {
      const digit = Number(key);
      const game = useGameStore.getState().game;
      // Parity with the number pad: a digit locked by "disable completed
      // numbers" isn't enterable from the keyboard either. Shake the dimmed
      // pad button so the rejection is visible, not a silent "is this broken?".
      if (useSettingsStore.getState().settings.disableCompletedNumbers && game) {
        const placed = game.values.filter((v) => v === digit).length;
        if (placed >= BOARD_SIZE) {
          useGameStore.getState().flashLockedDigit(digit);
          return;
        }
      }
      useGameStore.getState().pressNumber(digit);
      return;
    }
    switch (key.toLowerCase()) {
      case "backspace":
      case "delete":
      case "0":
      case "e":
        useGameStore.getState().erase();
        break;
      case "n":
        useGameStore.getState().toggleNotesMode();
        break;
      case "u":
        useGameStore.getState().undo();
        break;
      case "r":
        useGameStore.getState().redo();
        break;
    }
  };

  if (Platform.OS !== "ios") {
    return null;
  }

  return (
    <TextInput
      ref={inputRef}
      onKeyPress={onKeyPress}
      onBlur={() => {
        if (holdFocus.current) {
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }}
      // Enter must not end editing, or capture stops until the next refocus.
      submitBehavior="submit"
      showSoftInputOnFocus={false}
      caretHidden
      contextMenuHidden
      autoCorrect={false}
      autoCapitalize="none"
      spellCheck={false}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, opacity: 0 }}
    />
  );
}
