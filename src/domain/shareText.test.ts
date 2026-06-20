import { formatShareText, SHARE_APP_FOOTER } from "./shareText";

/** Every share string ends with a blank line + the download call-to-action. */
const withFooter = (result: string) => `${result}\n\n${SHARE_APP_FOOTER}`;

describe("formatShareText", () => {
  it("formats a non-daily result with singular/plural nouns", () => {
    expect(
      formatShareText({ difficulty: "hard", elapsedSeconds: 272, mistakes: 1, hintsUsed: 0 }),
    ).toBe(withFooter("Sudoku — Hard\n⏱ 04:32 · ❌ 1 mistake · 💡 0 hints"));
  });

  it("pluralizes mistakes and hints", () => {
    expect(
      formatShareText({ difficulty: "easy", elapsedSeconds: 65, mistakes: 2, hintsUsed: 3 }),
    ).toBe(withFooter("Sudoku — Easy\n⏱ 01:05 · ❌ 2 mistakes · 💡 3 hints"));
  });

  it("includes the date and streak line for a daily result", () => {
    expect(
      formatShareText({
        difficulty: "medium",
        elapsedSeconds: 600,
        mistakes: 0,
        hintsUsed: 1,
        daily: { kind: "daily", dateKey: "2026-06-19", streak: 5 },
      }),
    ).toBe(
      withFooter("Sudoku Daily — 2026-06-19\n⏱ 10:00 · ❌ 0 mistakes · 💡 1 hint\n🔥 5 day streak"),
    );
  });

  it("omits the streak line when the daily streak is zero", () => {
    expect(
      formatShareText({
        difficulty: "expert",
        elapsedSeconds: 0,
        mistakes: 0,
        hintsUsed: 0,
        daily: { kind: "daily", dateKey: "2026-06-19", streak: 0 },
      }),
    ).toBe(withFooter("Sudoku Daily — 2026-06-19\n⏱ 00:00 · ❌ 0 mistakes · 💡 0 hints"));
  });

  it("uses a singular day for a one-day streak", () => {
    expect(
      formatShareText({
        difficulty: "easy",
        elapsedSeconds: 120,
        mistakes: 0,
        hintsUsed: 0,
        daily: { kind: "daily", dateKey: "2026-06-19", streak: 1 },
      }),
    ).toBe(
      withFooter(
        "Sudoku Daily — 2026-06-19\n⏱ 02:00 · ❌ 0 mistakes · 💡 0 hints\n🔥 1 day streak",
      ),
    );
  });

  it("labels the challenge track and never shows a streak", () => {
    expect(
      formatShareText({
        difficulty: "extreme",
        elapsedSeconds: 905,
        mistakes: 3,
        hintsUsed: 4,
        daily: { kind: "challenge", dateKey: "2026-06-19", streak: 0 },
      }),
    ).toBe(withFooter("Sudoku Daily Challenge — 2026-06-19\n⏱ 15:05 · ❌ 3 mistakes · 💡 4 hints"));
  });

  it("omits time when showTimer is false", () => {
    expect(
      formatShareText({
        difficulty: "medium",
        elapsedSeconds: 600,
        mistakes: 1,
        hintsUsed: 0,
        showTimer: false,
      }),
    ).toBe(withFooter("Sudoku — Medium\n❌ 1 mistake · 💡 0 hints"));
  });

  it("omits mistakes when showMistakes is false", () => {
    expect(
      formatShareText({
        difficulty: "hard",
        elapsedSeconds: 120,
        mistakes: 2,
        hintsUsed: 1,
        showMistakes: false,
      }),
    ).toBe(withFooter("Sudoku — Hard\n⏱ 02:00 · 💡 1 hint"));
  });

  it("appends the store call-to-action to every result", () => {
    const text = formatShareText({
      difficulty: "hard",
      elapsedSeconds: 100,
      mistakes: 0,
      hintsUsed: 0,
    });
    expect(text.endsWith(SHARE_APP_FOOTER)).toBe(true);
    expect(text).toContain("apps.apple.com");
  });
});
