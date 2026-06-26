import { buildShareLink, type ShareLinkInput } from "./shareLink";
import { formatShareText } from "./shareText";

const BEAT_CTA = "Think you can beat it? Tap to play the same puzzle:";
const PLAIN_CTA = "Tap to play this exact puzzle:";

/** Each share string ends with a CTA + the deep link to the same puzzle. */
const withLink = (block: string, cta: string, link: ShareLinkInput) =>
  `${block}\n\n${cta}\n${buildShareLink(link)}`;

describe("formatShareText", () => {
  it("formats a non-daily result with singular/plural nouns and a puzzle link", () => {
    expect(
      formatShareText({
        difficulty: "hard",
        puzzleId: "hard_0007",
        elapsedSeconds: 272,
        mistakes: 1,
        hintsUsed: 0,
      }),
    ).toBe(
      withLink("Sudoku — Hard\n⏱ 04:32 · ❌ 1 mistake · 💡 0 hints", BEAT_CTA, {
        kind: "puzzle",
        ref: "hard_0007",
        difficulty: "hard",
        timeSeconds: 272,
        mistakes: 1,
      }),
    );
  });

  it("pluralizes mistakes and hints", () => {
    expect(
      formatShareText({
        difficulty: "easy",
        puzzleId: "easy_0001",
        elapsedSeconds: 65,
        mistakes: 2,
        hintsUsed: 3,
      }),
    ).toBe(
      withLink("Sudoku — Easy\n⏱ 01:05 · ❌ 2 mistakes · 💡 3 hints", BEAT_CTA, {
        kind: "puzzle",
        ref: "easy_0001",
        difficulty: "easy",
        timeSeconds: 65,
        mistakes: 2,
      }),
    );
  });

  it("includes the date, streak line, and a date-based daily link", () => {
    expect(
      formatShareText({
        difficulty: "medium",
        puzzleId: "daily_0003",
        elapsedSeconds: 600,
        mistakes: 0,
        hintsUsed: 1,
        daily: { kind: "daily", dateKey: "2026-06-19", streak: 5 },
      }),
    ).toBe(
      withLink(
        "Sudoku Daily — 2026-06-19\n⏱ 10:00 · ❌ 0 mistakes · 💡 1 hint\n🔥 5 day streak",
        BEAT_CTA,
        { kind: "daily", ref: "2026-06-19", timeSeconds: 600, mistakes: 0 },
      ),
    );
  });

  it("omits the streak line when the daily streak is zero", () => {
    expect(
      formatShareText({
        difficulty: "expert",
        puzzleId: "daily_0004",
        elapsedSeconds: 0,
        mistakes: 0,
        hintsUsed: 0,
        daily: { kind: "daily", dateKey: "2026-06-19", streak: 0 },
      }),
    ).toBe(
      withLink("Sudoku Daily — 2026-06-19\n⏱ 00:00 · ❌ 0 mistakes · 💡 0 hints", BEAT_CTA, {
        kind: "daily",
        ref: "2026-06-19",
        timeSeconds: 0,
        mistakes: 0,
      }),
    );
  });

  it("labels the challenge track and never shows a streak", () => {
    expect(
      formatShareText({
        difficulty: "extreme",
        puzzleId: "challenge_0002",
        elapsedSeconds: 905,
        mistakes: 3,
        hintsUsed: 4,
        daily: { kind: "challenge", dateKey: "2026-06-19", streak: 0 },
      }),
    ).toBe(
      withLink(
        "Sudoku Daily Challenge — 2026-06-19\n⏱ 15:05 · ❌ 3 mistakes · 💡 4 hints",
        BEAT_CTA,
        {
          kind: "challenge",
          ref: "2026-06-19",
          timeSeconds: 905,
          mistakes: 3,
        },
      ),
    );
  });

  it("omits time from the line and the link when showTimer is false", () => {
    expect(
      formatShareText({
        difficulty: "medium",
        puzzleId: "medium_0005",
        elapsedSeconds: 600,
        mistakes: 1,
        hintsUsed: 0,
        showTimer: false,
      }),
    ).toBe(
      withLink("Sudoku — Medium\n❌ 1 mistake · 💡 0 hints", BEAT_CTA, {
        kind: "puzzle",
        ref: "medium_0005",
        difficulty: "medium",
        timeSeconds: null,
        mistakes: 1,
      }),
    );
  });

  it("omits mistakes from the line and the link when showMistakes is false", () => {
    expect(
      formatShareText({
        difficulty: "hard",
        puzzleId: "hard_0009",
        elapsedSeconds: 120,
        mistakes: 2,
        hintsUsed: 1,
        showMistakes: false,
      }),
    ).toBe(
      withLink("Sudoku — Hard\n⏱ 02:00 · 💡 1 hint", BEAT_CTA, {
        kind: "puzzle",
        ref: "hard_0009",
        difficulty: "hard",
        timeSeconds: 120,
        mistakes: null,
      }),
    );
  });

  it("uses the plain invite when both timer and mistakes are hidden", () => {
    const text = formatShareText({
      difficulty: "easy",
      puzzleId: "easy_0010",
      elapsedSeconds: 100,
      mistakes: 0,
      hintsUsed: 0,
      showTimer: false,
      showMistakes: false,
    });
    expect(text).toBe(
      withLink("Sudoku — Easy\n💡 0 hints", PLAIN_CTA, {
        kind: "puzzle",
        ref: "easy_0010",
        difficulty: "easy",
        timeSeconds: null,
        mistakes: null,
      }),
    );
  });
});
