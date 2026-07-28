import { isReviewPromptEligible, REVIEW_COOLDOWN_MS } from "@/domain/reviewPrompt";

describe("isReviewPromptEligible", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");

  it("waits for three completions across two sessions", () => {
    expect(
      isReviewPromptEligible({
        completedGames: 2,
        sessionCount: 2,
        lastAttemptAt: null,
        now,
      }),
    ).toBe(false);
    expect(
      isReviewPromptEligible({
        completedGames: 3,
        sessionCount: 1,
        lastAttemptAt: null,
        now,
      }),
    ).toBe(false);
    expect(
      isReviewPromptEligible({
        completedGames: 3,
        sessionCount: 2,
        lastAttemptAt: null,
        now,
      }),
    ).toBe(true);
  });

  it("enforces the app-defined cooldown", () => {
    expect(
      isReviewPromptEligible({
        completedGames: 10,
        sessionCount: 5,
        lastAttemptAt: new Date(now.getTime() - REVIEW_COOLDOWN_MS + 1).toISOString(),
        now,
      }),
    ).toBe(false);
    expect(
      isReviewPromptEligible({
        completedGames: 10,
        sessionCount: 5,
        lastAttemptAt: new Date(now.getTime() - REVIEW_COOLDOWN_MS).toISOString(),
        now,
      }),
    ).toBe(true);
  });

  it("recovers from an invalid persisted timestamp", () => {
    expect(
      isReviewPromptEligible({
        completedGames: 3,
        sessionCount: 2,
        lastAttemptAt: "not-a-date",
        now,
      }),
    ).toBe(true);
  });
});
