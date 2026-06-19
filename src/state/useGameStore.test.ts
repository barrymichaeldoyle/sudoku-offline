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

describe("useGameStore reducers", () => {
  beforeEach(() => {
    mockHasRemoveAds.mockReturnValue(false);
    mockIsRewardedHintAvailable.mockResolvedValue(true); // online by default
    mockShowRewardedHintAd.mockResolvedValue(false);
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
    load();
    useGameStore.getState().setInputMode("cell");
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

  it("does not count mistakes when mistake checking is disabled", () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, mistakeCheckingEnabled: false },
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
