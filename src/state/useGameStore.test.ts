import type { GameState } from "@/domain/sudoku/types";

// Isolate the reducer logic from IO: no SQLite, haptics, or analytics.
jest.mock("@/services/haptics", () => ({
  haptics: { place: jest.fn(), invalid: jest.fn(), complete: jest.fn(), toggle: jest.fn() },
}));
jest.mock("@/services/analyticsService", () => ({ track: jest.fn() }));
jest.mock("@/data/repositories/gameRepository", () => ({
  saveGame: jest.fn().mockResolvedValue(undefined),
  completeGame: jest.fn().mockResolvedValue(undefined),
  getGameById: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/services/adService", () => ({
  adService: {
    isRewardedHintAvailable: jest.fn().mockResolvedValue(false),
    showRewardedHintAd: jest.fn().mockResolvedValue(false),
  },
}));
jest.mock("@/state/useEntitlementStore", () => ({ hasRemoveAds: jest.fn(() => false) }));

import { DEFAULT_SETTINGS } from "@/domain/settings";
import { adService } from "@/services/adService";
import { hasRemoveAds } from "@/state/useEntitlementStore";
import { useSettingsStore } from "@/state/useSettingsStore";

import { useGameStore } from "./useGameStore";

const mockShowRewardedHintAd = adService.showRewardedHintAd as jest.Mock;
const mockIsRewardedHintAvailable = adService.isRewardedHintAvailable as jest.Mock;
const mockHasRemoveAds = hasRemoveAds as jest.Mock;

// A valid completed grid; givens are all empty so every cell is editable.
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const GIVENS = "0".repeat(81);

function freshGame(): GameState {
  return {
    id: "test-game",
    puzzleId: "p1",
    difficulty: "easy",
    givens: GIVENS,
    solution: SOLUTION,
    values: Array.from({ length: 81 }, () => null),
    notes: Array.from({ length: 81 }, () => 0),
    status: "active",
    elapsedSeconds: 0,
    mistakes: 0,
    hintsUsed: 0,
    startedAt: "2026-06-19T00:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-06-19T00:00:00.000Z",
  };
}

function load(): void {
  useGameStore.getState().setGame(freshGame());
}

/** The solved board, optionally with some cells overridden (e.g. one left null). */
function valuesFromSolution(overrides: Record<number, number | null> = {}): (number | null)[] {
  const values = SOLUTION.split("").map((c) => Number(c) as number | null);
  for (const [index, value] of Object.entries(overrides)) {
    values[Number(index)] = value;
  }
  return values;
}

describe("useGameStore reducers", () => {
  beforeEach(() => {
    // Store actions schedule a 600ms debounced save (setTimeout). Fake timers
    // keep those from leaking past the suite (which force-exits the worker).
    // Date stays real so the Date.now()-based hint-cooldown assertions hold.
    jest.useFakeTimers({ doNotFake: ["Date"] });
    mockHasRemoveAds.mockReturnValue(false);
    mockIsRewardedHintAvailable.mockResolvedValue(true); // online by default
    mockShowRewardedHintAd.mockResolvedValue(false);
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
    load();
    useGameStore.getState().setInputMode("cell");
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("places a value into the selected cell (cell-first)", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(5); // SOLUTION[0] === 5
    const game = useGameStore.getState().game!;
    expect(game.values[0]).toBe(5);
    expect(game.mistakes).toBe(0);
  });

  it("clears the value when the same number is tapped again", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(5);
    s.pressNumber(5);
    expect(useGameStore.getState().game!.values[0]).toBeNull();
  });

  it("increments mistakes when the placed value disagrees with the solution", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(3); // wrong: SOLUTION[0] === 5
    const game = useGameStore.getState().game!;
    expect(game.values[0]).toBe(3);
    expect(game.mistakes).toBe(1);
  });

  it("toggles a pencil note in notes mode without setting a value", () => {
    const s = useGameStore.getState();
    s.toggleNotesMode();
    s.pressCell(0);
    s.pressNumber(7);
    const game = useGameStore.getState().game!;
    expect(game.values[0]).toBeNull();
    expect(game.notes[0]).toBe(1 << 6); // note 7 -> bit 6
  });

  describe("auto-carry notes (cell-first)", () => {
    const NOTE_5 = 1 << 4; // note 5 -> bit 4

    it("repeats the note onto the next peer cell tapped", () => {
      const s = useGameStore.getState();
      s.toggleNotesMode();
      s.pressCell(0);
      s.pressNumber(5);
      s.pressCell(1); // same row/box as cell 0 -> peer
      const game = useGameStore.getState().game!;
      expect(game.notes[1]).toBe(NOTE_5);
      expect(useGameStore.getState().selectedCell).toBe(1);
    });

    it("carries only once, not to the following peer", () => {
      const s = useGameStore.getState();
      s.toggleNotesMode();
      s.pressCell(0);
      s.pressNumber(5);
      s.pressCell(1); // peer of 0 -> carried
      s.pressCell(2); // peer of 1, but carry is already spent
      const game = useGameStore.getState().game!;
      expect(game.notes[1]).toBe(NOTE_5);
      expect(game.notes[2]).toBe(0);
      expect(useGameStore.getState().carryNoteDigit).toBeNull();
    });

    it("does not carry to a non-peer cell and ends the carry", () => {
      const s = useGameStore.getState();
      s.toggleNotesMode();
      s.pressCell(0);
      s.pressNumber(5);
      s.pressCell(80); // different row, column, and box -> not aligned
      const game = useGameStore.getState().game!;
      expect(game.notes[80]).toBe(0);
      expect(useGameStore.getState().selectedCell).toBe(80);
      // Carry ended: tapping an aligned box cell now should not add a note.
      s.pressCell(79); // same box/row as 80, but carry is cleared
      expect(useGameStore.getState().game!.notes[79]).toBe(0);
    });

    it("carries down a column within the same box", () => {
      const s = useGameStore.getState();
      s.toggleNotesMode();
      s.pressCell(0);
      s.pressNumber(5);
      s.pressCell(9); // same box, same column as cell 0
      expect(useGameStore.getState().game!.notes[9]).toBe(NOTE_5);
    });

    it("does not carry to a same-row cell in a different box", () => {
      const s = useGameStore.getState();
      s.toggleNotesMode();
      s.pressCell(0);
      s.pressNumber(5);
      s.pressCell(3); // same row, but box 1 -> not aligned within a box
      expect(useGameStore.getState().game!.notes[3]).toBe(0);
    });

    it("does not carry to a diagonal cell in the same box", () => {
      const s = useGameStore.getState();
      s.toggleNotesMode();
      s.pressCell(0);
      s.pressNumber(5);
      s.pressCell(10); // same box, but different row and column
      expect(useGameStore.getState().game!.notes[10]).toBe(0);
    });

    it("does nothing when the setting is off", () => {
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, autoCarryNotes: false },
      }));
      const s = useGameStore.getState();
      s.toggleNotesMode();
      s.pressCell(0);
      s.pressNumber(5);
      s.pressCell(1);
      expect(useGameStore.getState().game!.notes[1]).toBe(0);
    });

    it("does not carry in number-first mode", () => {
      useGameStore.getState().setInputMode("number");
      const s = useGameStore.getState();
      s.toggleNotesMode();
      s.pressNumber(5); // select the digit
      s.pressCell(0); // pencil 5 into cell 0
      s.pressCell(1); // peer, but number-first re-applies the selected digit anyway
      const game = useGameStore.getState().game!;
      // Both cells get note 5 because the digit stays selected, not via carry.
      expect(game.notes[0]).toBe(NOTE_5);
      expect(game.notes[1]).toBe(NOTE_5);
      expect(useGameStore.getState().carryNoteDigit).toBeNull();
    });
  });

  it("erases a cell and undo restores it", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(5);
    s.erase();
    expect(useGameStore.getState().game!.values[0]).toBeNull();
    useGameStore.getState().undo();
    expect(useGameStore.getState().game!.values[0]).toBe(5);
  });

  it("undo reverses the last placement", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(5);
    s.undo();
    expect(useGameStore.getState().game!.values[0]).toBeNull();
    expect(useGameStore.getState().undoStack).toHaveLength(0);
  });

  it("undo restores peer notes cleared by auto note cleanup", () => {
    const s = useGameStore.getState();
    const NOTE_5 = 1 << 4; // note 5 -> bit 4
    // Pencil note 5 into cell 1 (a peer of cell 0 in the same row).
    s.toggleNotesMode();
    s.pressCell(1);
    s.pressNumber(5);
    s.toggleNotesMode();
    expect(useGameStore.getState().game!.notes[1]).toBe(NOTE_5);

    // Placing 5 in cell 0 auto-clears the note 5 from peer cell 1.
    s.pressCell(0);
    s.pressNumber(5); // SOLUTION[0] === 5
    expect(useGameStore.getState().game!.notes[1]).toBe(0);

    // Undo must put the value back to null AND restore the peer note.
    useGameStore.getState().undo();
    const game = useGameStore.getState().game!;
    expect(game.values[0]).toBeNull();
    expect(game.notes[1]).toBe(NOTE_5);
  });

  it("restart clears the board back to givens and resets progress", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(3); // wrong → a mistake
    // A pencil note elsewhere, to confirm notes are wiped too.
    s.toggleNotesMode();
    s.pressCell(1);
    s.pressNumber(7);
    s.toggleNotesMode();
    expect(useGameStore.getState().game!.mistakes).toBe(1);
    expect(useGameStore.getState().game!.notes[1]).not.toBe(0);

    useGameStore.getState().restart();
    const game = useGameStore.getState().game!;
    // GIVENS is all-empty, so every value resets to null.
    expect(game.values.every((v) => v === null)).toBe(true);
    expect(game.notes.every((n) => n === 0)).toBe(true);
    expect(game.mistakes).toBe(0);
    expect(game.hintsUsed).toBe(0);
    expect(game.elapsedSeconds).toBe(0);
    expect(game.status).toBe("active");
    expect(useGameStore.getState().undoStack).toHaveLength(0);
  });

  it("restart keeps the same game id (daily stays linked)", () => {
    const id = useGameStore.getState().game!.id;
    useGameStore.getState().pressCell(0);
    useGameStore.getState().pressNumber(5);
    useGameStore.getState().restart();
    expect(useGameStore.getState().game!.id).toBe(id);
  });

  it("restart resets the timer by default but keeps it with keepTime", () => {
    const g = useGameStore.getState().game!;
    // Freeze a known elapsed total (timer not running, so commitElapsed is exact).
    useGameStore.setState({
      game: { ...g, elapsedSeconds: 42 },
      running: false,
      lastStartedAt: null,
    });

    useGameStore.getState().restart({ keepTime: true });
    expect(useGameStore.getState().game!.elapsedSeconds).toBe(42);

    useGameStore.setState({
      game: { ...useGameStore.getState().game!, elapsedSeconds: 42 },
      running: false,
      lastStartedAt: null,
    });
    useGameStore.getState().restart();
    expect(useGameStore.getState().game!.elapsedSeconds).toBe(0);
  });

  it("setInputMode persists to settings and is shared, clearing selection", () => {
    const s = useGameStore.getState();
    s.setInputMode("number");
    expect(useSettingsStore.getState().settings.inputMode).toBe("number");

    // Number-first: tapping a number selects it (rather than needing a cell first).
    useGameStore.getState().pressNumber(5);
    expect(useGameStore.getState().selectedNumber).toBe(5);

    // Switching modes clears the live selection.
    useGameStore.getState().setInputMode("cell");
    expect(useSettingsStore.getState().settings.inputMode).toBe("cell");
    expect(useGameStore.getState().selectedNumber).toBeNull();
  });

  describe("filled-but-incorrect board", () => {
    // Pre-fill 80 cells from the solution, leaving the last one (index 80) empty.
    function loadNearlyComplete(): void {
      useGameStore.getState().setGame({ ...freshGame(), values: valuesFromSolution({ 80: null }) });
      useGameStore.getState().setInputMode("cell");
    }

    it("flags incorrectComplete when the last cell makes the board full but wrong", () => {
      loadNearlyComplete();
      const s = useGameStore.getState();
      s.pressCell(80);
      s.pressNumber(8); // SOLUTION[80] === 9, so 8 is wrong
      const state = useGameStore.getState();
      expect(state.incorrectComplete).toBe(true);
      expect(state.justCompleted).toBe(false);
      expect(state.game!.status).toBe("active");
    });

    it("does not flag when the board is completed correctly", () => {
      loadNearlyComplete();
      const s = useGameStore.getState();
      s.pressCell(80);
      s.pressNumber(9); // correct
      const state = useGameStore.getState();
      expect(state.incorrectComplete).toBe(false);
      expect(state.justCompleted).toBe(true);
      expect(state.game!.status).toBe("completed");
    });

    it("does not re-flag while editing an already-full wrong board", () => {
      loadNearlyComplete();
      const s = useGameStore.getState();
      s.pressCell(80);
      s.pressNumber(8); // full + wrong → flagged
      useGameStore.getState().dismissIncorrectComplete();
      expect(useGameStore.getState().incorrectComplete).toBe(false);

      // Replace a different cell while the board stays full — no transition, so
      // the modal must not re-appear on each tap.
      s.pressCell(79);
      s.pressNumber(1); // SOLUTION[79] === 7; board remains full and wrong
      expect(useGameStore.getState().incorrectComplete).toBe(false);
    });

    it("restart clears the incorrectComplete flag", () => {
      loadNearlyComplete();
      const s = useGameStore.getState();
      s.pressCell(80);
      s.pressNumber(8);
      expect(useGameStore.getState().incorrectComplete).toBe(true);
      useGameStore.getState().restart();
      expect(useGameStore.getState().incorrectComplete).toBe(false);
    });
  });

  it("activates a paused game when setGame is called", () => {
    useGameStore.getState().setGame({ ...freshGame(), status: "paused" });
    const game = useGameStore.getState().game!;
    expect(game.status).toBe("active");
    expect(useGameStore.getState().running).toBe(true);
  });

  describe("syncTimerFromSettings", () => {
    it("starts the timer when timer is enabled mid-game", () => {
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, timerEnabled: false },
      }));
      useGameStore.getState().setGame(freshGame());
      expect(useGameStore.getState().running).toBe(false);

      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, timerEnabled: true },
      }));
      useGameStore.getState().syncTimerFromSettings();

      expect(useGameStore.getState().running).toBe(true);
      expect(useGameStore.getState().lastStartedAt).not.toBeNull();
    });

    it("stops and commits elapsed time when timer is disabled mid-game", () => {
      useGameStore.getState().setGame(freshGame());
      useGameStore.setState({ lastStartedAt: Date.now() - 5000 });

      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, timerEnabled: false },
      }));
      useGameStore.getState().syncTimerFromSettings();

      expect(useGameStore.getState().running).toBe(false);
      expect(useGameStore.getState().game!.elapsedSeconds).toBeGreaterThanOrEqual(5);
    });
  });

  it("does not count mistakes when mistake tracking is disabled", () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, mistakeTrackingEnabled: false },
    }));
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(3);
    expect(useGameStore.getState().game!.mistakes).toBe(0);
  });

  describe("hint flow", () => {
    it("opens the rewarded prompt for non-premium players when an ad is loaded", async () => {
      await useGameStore.getState().requestHint();
      const state = useGameStore.getState();
      // No reveal — an ad is available, so the hint is gated behind it.
      expect(state.game!.hintsUsed).toBe(0);
      expect(state.game!.values.every((v) => v == null)).toBe(true);
      expect(state.hintPromptVisible).toBe(true);
      expect(state.hintPromptMode).toBe("rewarded");
    });

    it("opens a confirm prompt when offline (no ad available)", async () => {
      mockIsRewardedHintAvailable.mockResolvedValue(false);
      await useGameStore.getState().requestHint();
      const state = useGameStore.getState();
      expect(state.game!.hintsUsed).toBe(0);
      expect(state.hintPromptVisible).toBe(true);
      expect(state.hintPromptMode).toBe("confirm");
    });

    it("reveals a free hint after confirming while offline", async () => {
      mockIsRewardedHintAvailable.mockResolvedValue(false);
      await useGameStore.getState().requestHint();
      useGameStore.getState().confirmHint();
      const state = useGameStore.getState();
      expect(state.game!.hintsUsed).toBe(1);
      expect(state.hintPromptVisible).toBe(false);
      const placed = state.game!.values.findIndex((v) => v != null);
      expect(state.game!.values[placed]).toBe(Number(SOLUTION[placed]));
    });

    it("opens a confirm prompt for premium instead of revealing instantly", async () => {
      mockHasRemoveAds.mockReturnValue(true);
      await useGameStore.getState().requestHint();
      const state = useGameStore.getState();
      expect(state.game!.hintsUsed).toBe(0);
      expect(state.hintPromptVisible).toBe(true);
      expect(state.hintPromptMode).toBe("confirm");
    });

    it("reveals instantly for premium when instant hints is enabled", async () => {
      mockHasRemoveAds.mockReturnValue(true);
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, instantHintsEnabled: true },
      }));
      await useGameStore.getState().requestHint();
      const state = useGameStore.getState();
      expect(state.game!.hintsUsed).toBe(1);
      expect(state.hintPromptVisible).toBe(false);
    });

    it("reveals for premium after the player confirms", async () => {
      mockHasRemoveAds.mockReturnValue(true);
      await useGameStore.getState().requestHint();
      useGameStore.getState().confirmHint();
      expect(useGameStore.getState().game!.hintsUsed).toBe(1);

      // Cooldown gates spamming even for premium; once cleared, another confirms.
      useGameStore.setState({ hintCooldownUntil: null });
      await useGameStore.getState().requestHint();
      useGameStore.getState().confirmHint();
      expect(useGameStore.getState().game!.hintsUsed).toBe(2);
    });

    it("starts a cooldown after a reveal and blocks the next hint", async () => {
      mockIsRewardedHintAvailable.mockResolvedValue(false); // offline → confirm first
      await useGameStore.getState().requestHint();
      useGameStore.getState().confirmHint();
      const after = useGameStore.getState();
      expect(after.game!.hintsUsed).toBe(1);
      expect(after.hintCooldownUntil).not.toBeNull();
      expect(after.hintCooldownUntil!).toBeGreaterThan(Date.now());

      // Spamming during the cooldown is a no-op.
      await useGameStore.getState().requestHint();
      expect(useGameStore.getState().game!.hintsUsed).toBe(1);
    });

    it("undoing a hint lifts the cooldown but keeps hintsUsed counted", async () => {
      mockIsRewardedHintAvailable.mockResolvedValue(false);
      await useGameStore.getState().requestHint();
      useGameStore.getState().confirmHint();
      const revealed = useGameStore.getState();
      const placed = revealed.game!.values.findIndex((v) => v != null);
      expect(revealed.hintCooldownUntil).not.toBeNull();

      useGameStore.getState().undo();
      const after = useGameStore.getState();
      expect(after.game!.values[placed]).toBeNull(); // the hint is undone
      expect(after.hintCooldownUntil).toBeNull(); // cooldown lifted
      expect(after.game!.hintsUsed).toBe(1); // but the hint was still spent
    });

    it("undoing a normal placement leaves the hint cooldown intact", async () => {
      // Reveal a hint to start a cooldown, then make a manual placement on top.
      mockIsRewardedHintAvailable.mockResolvedValue(false);
      await useGameStore.getState().requestHint();
      useGameStore.getState().confirmHint();
      const cooldown = useGameStore.getState().hintCooldownUntil;
      expect(cooldown).not.toBeNull();

      const empty = useGameStore.getState().game!.values.findIndex((v) => v == null);
      const s = useGameStore.getState();
      s.pressCell(empty);
      s.pressNumber(Number(SOLUTION[empty]));
      // Undoing the manual placement must not touch the hint cooldown.
      useGameStore.getState().undo();
      expect(useGameStore.getState().hintCooldownUntil).toBe(cooldown);
    });

    it("allows another hint once the cooldown elapses", async () => {
      mockIsRewardedHintAvailable.mockResolvedValue(false);
      await useGameStore.getState().requestHint();
      useGameStore.getState().confirmHint();
      useGameStore.setState({ hintCooldownUntil: Date.now() - 1 });
      await useGameStore.getState().requestHint();
      useGameStore.getState().confirmHint();
      expect(useGameStore.getState().game!.hintsUsed).toBe(2);
    });

    it("reveals a hint when the rewarded ad grants a reward", async () => {
      await useGameStore.getState().requestHint();
      expect(useGameStore.getState().hintPromptVisible).toBe(true);

      mockShowRewardedHintAd.mockResolvedValue(true);
      await useGameStore.getState().confirmRewardedHint();

      expect(useGameStore.getState().game!.hintsUsed).toBe(1);
      expect(useGameStore.getState().hintPromptVisible).toBe(false);
    });

    it("leaves the prompt open when the rewarded ad grants nothing", async () => {
      await useGameStore.getState().requestHint();

      mockShowRewardedHintAd.mockResolvedValue(false);
      await useGameStore.getState().confirmRewardedHint();

      expect(useGameStore.getState().game!.hintsUsed).toBe(0);
      expect(useGameStore.getState().hintPromptVisible).toBe(true);
    });
  });
});
