import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  TextInput,
  type TextInputKeyPressEvent,
  type TextInputSelectionChangeEvent,
} from "react-native";

import { isDigitCompleted, isGivenCell } from "@/domain/sudoku/board";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";

/**
 * Invisible, always-focused input that turns hardware-keyboard keystrokes into
 * game actions, for anyone playing with an external keyboard (iPad and Android
 * keyboards, the simulators with a connected hardware keyboard):
 *
 *   1-9        enter the digit (same path as the number pad, so notes mode and
 *              number-first input behave exactly like tapping the pad)
 *   0 / ⌫ / e  erase (cell-first) or arm the erase tool (number-first)
 *   n          toggle notes mode
 *   u / r      undo / redo
 *   arrows     move the selection ring around the board
 *
 * Capture is per-platform, because each OS withholds a different part of the
 * hardware keyboard from JS:
 *
 *   - iOS delivers characters and backspace through onKeyPress (the proven
 *     path — dispatching from onChangeText there risks double-firing via
 *     Fabric's duplicate change emissions for controlled inputs) but never
 *     arrows, which don't produce characters.
 *   - Android delivers no hardware keys through onKeyPress at all, so
 *     characters are diffed out of the buffer in onChangeText and backspace
 *     is the buffer shrinking.
 *   - Arrows on both platforms come from the caret: the field holds a tiny
 *     three-line buffer with the caret resting mid-center, and the landing
 *     offset in onSelectionChange identifies the direction (up/down hit the
 *     outer lines, left/right shift within the middle one).
 *
 * After every keystroke the text and caret snap back to the canonical state so
 * the next key is read against it. Arrow handling is deferred one tick because
 * typing also moves the caret (to the same offset as arrow-right); a text
 * change arriving in the meantime cancels the pending arrow.
 *
 * The soft keyboard stays hidden (showSoftInputOnFocus={false}), so touch
 * players never see this input exists. The game screen mounts it only while
 * the board is editable — never under the pause/reset/hint/completion
 * overlays, which keyboard input would otherwise bypass.
 */

// Three lines with the caret resting mid-line so every arrow has somewhere to
// go: up/down land on the outer lines, left/right shift within the middle one.
const BUFFER = " \n   \n ";
const CENTER = 3;

/** Caret landing offset → arrow direction, as [dRow, dCol]. */
function arrowFromOffset(offset: number): [number, number] | null {
  if (offset <= 1) return [-1, 0]; // up: first line
  if (offset === 2) return [0, -1]; // left: one before center
  if (offset === 4 || offset === 5) return [0, 1]; // right: past center
  if (offset >= 6) return [1, 0]; // down: last line
  return null;
}

export function HardwareKeyboardCapture() {
  const inputRef = useRef<TextInput>(null);
  // Distinguishes our own deliberate blur (screen lost focus) from focus being
  // stolen by something else, which we recover from by refocusing.
  const holdFocus = useRef(false);
  // The text the native field currently holds, tracked synchronously so
  // selection events can tell "caret moved" apart from "text mutated".
  const nativeText = useRef(BUFFER);
  // Focusing drops the caret wherever the platform likes (often the end, which
  // reads as arrow-down). The probe only acts once the caret is settled on
  // CENTER; anything before that just snaps it home. Arming is time-based as
  // well as event-based because iOS never emits a selection event for our own
  // programmatic snap-backs (Android does), so an iOS probe waiting to *see*
  // the caret at rest would wait forever.
  const armed = useRef(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArrow = useRef<ReturnType<typeof setTimeout> | null>(null);
  // gen bumps force a re-render, which is what pushes the canonical text and
  // caret position back down to the native field after a keystroke disturbs
  // them (React won't re-send unchanged props without it).
  const [probe, setProbe] = useState({ text: BUFFER, gen: 0 });

  const scheduleArm = useCallback(() => {
    if (armTimer.current) {
      clearTimeout(armTimer.current);
    }
    armTimer.current = setTimeout(() => {
      armed.current = true;
    }, 300);
  }, []);

  useFocusEffect(
    useCallback(() => {
      holdFocus.current = true;
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      scheduleArm();
      return () => {
        holdFocus.current = false;
        armed.current = false;
        clearTimeout(id);
        if (armTimer.current) {
          clearTimeout(armTimer.current);
        }
        if (pendingArrow.current) {
          clearTimeout(pendingArrow.current);
        }
        inputRef.current?.blur();
      };
    }, [scheduleArm]),
  );

  // Second phase of the snap-back: the keystroke's render showed the disturbed
  // text (matching native, so nothing was pushed); this one restores BUFFER.
  useEffect(() => {
    if (probe.text !== BUFFER) {
      nativeText.current = BUFFER;
      setProbe((p) => ({ text: BUFFER, gen: p.gen + 1 }));
    }
  }, [probe.text]);

  const handleKey = (key: string) => {
    if (key >= "1" && key <= "9") {
      const digit = Number(key);
      const game = useGameStore.getState().game;
      // Parity with the number pad: a digit locked by "disable completed
      // numbers" isn't enterable from the keyboard either. Shake the dimmed
      // pad button so the rejection is visible, not a silent "is this broken?".
      if (useSettingsStore.getState().settings.disableCompletedNumbers && game) {
        if (isDigitCompleted(game.values, digit)) {
          // Exception: re-typing the digit on the editable cell that holds it
          // is a toggle-clear (a removal), which must stay possible — one of
          // those nine placements may be the mistake the player is fixing.
          const { selectedCell, notesMode } = useGameStore.getState();
          const clearsSelectedCell =
            useSettingsStore.getState().settings.inputMode === "cell" &&
            !notesMode &&
            selectedCell != null &&
            game.values[selectedCell] === digit &&
            !isGivenCell(game.givens, selectedCell) &&
            !game.hintedCells.includes(selectedCell);
          if (!clearsSelectedCell) {
            useGameStore.getState().flashLockedDigit(digit);
            return;
          }
        }
      }
      useGameStore.getState().pressNumber(digit);
      return;
    }
    switch (key.toLowerCase()) {
      case "backspace":
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

  // iOS path for characters and backspace: onKeyPress sees hardware keys
  // there (it was the original, proven capture), and dispatching from it
  // avoids Fabric's occasional duplicate onChangeText emissions for
  // controlled inputs, which would double-fire a digit — placing it and then
  // immediately toggle-clearing it, leaving only the mistake tally behind.
  const onKeyPress = (e: TextInputKeyPressEvent) => {
    if (Platform.OS === "android") {
      return; // Android never delivers hardware keys here.
    }
    handleKey(e.nativeEvent.key);
  };

  const onChangeText = (text: string) => {
    if (text === nativeText.current) {
      return; // Duplicate emission for a state the probe already handled.
    }
    nativeText.current = text;
    // The caret movement that comes with typing must not read as an arrow.
    if (pendingArrow.current) {
      clearTimeout(pendingArrow.current);
      pendingArrow.current = null;
    }
    // Android path for characters and backspace: hardware keys never reach
    // onKeyPress there, so the keystroke is read out of what it did to the
    // buffer. On iOS the dispatch already happened in onKeyPress; here the
    // buffer is only resynced.
    if (Platform.OS === "android") {
      if (text.length < BUFFER.length) {
        handleKey("Backspace");
      } else if (text.length === BUFFER.length + 1) {
        let inserted: string | null = null;
        for (let i = 0; i < text.length; i++) {
          if (text[i] !== BUFFER[i]) {
            inserted = text[i];
            break;
          }
        }
        // Spaces and newlines are buffer padding, not game keys.
        if (inserted && inserted !== " " && inserted !== "\n") {
          handleKey(inserted);
        }
      }
      // Anything else (multi-character paste, IME oddities): just resync.
    }
    setProbe((p) => ({ ...p, text }));
  };

  const onSelectionChange = (e: TextInputSelectionChangeEvent) => {
    const { start, end } = e.nativeEvent.selection;
    if (start !== end) {
      return;
    }
    if (start === CENTER) {
      armed.current = true;
      return;
    }
    // Caret moved as a side effect of a text mutation; the snap-back that the
    // change handler queued will bring it home.
    if (nativeText.current !== BUFFER) {
      return;
    }
    if (!armed.current) {
      // Settling after focus: send the caret home and (re)start the arming
      // window rather than acting — the platform may drop it anywhere.
      setProbe((p) => ({ ...p, gen: p.gen + 1 }));
      scheduleArm();
      return;
    }
    const arrow = arrowFromOffset(start);
    if (pendingArrow.current) {
      clearTimeout(pendingArrow.current);
    }
    // Deferred so a typing keystroke (whose change event may arrive after this
    // selection event) can cancel it instead of double-firing as arrow-right.
    pendingArrow.current = setTimeout(() => {
      pendingArrow.current = null;
      if (arrow && nativeText.current === BUFFER) {
        useGameStore.getState().moveSelection(arrow[0], arrow[1]);
      }
      setProbe((p) => ({ ...p, gen: p.gen + 1 }));
    }, 30);
  };

  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }

  return (
    <TextInput
      ref={inputRef}
      value={probe.text}
      selection={{ start: CENTER, end: CENTER }}
      onKeyPress={onKeyPress}
      onChangeText={onChangeText}
      onSelectionChange={onSelectionChange}
      onBlur={() => {
        armed.current = false;
        if (holdFocus.current) {
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }}
      multiline
      scrollEnabled={false}
      // Enter must not end editing (or insert a newline into the buffer).
      submitBehavior="submit"
      showSoftInputOnFocus={false}
      caretHidden
      contextMenuHidden
      autoCorrect={false}
      autoCapitalize="none"
      spellCheck={false}
      autoComplete="off"
      importantForAutofill="no"
      // Marks the field as no-suggestions territory so the Android keyboard
      // app doesn't float a prediction strip over the game while hardware keys
      // are typed into the (invisible) buffer. iOS keeps its default.
      keyboardType={Platform.OS === "android" ? "visible-password" : undefined}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, opacity: 0 }}
    />
  );
}
