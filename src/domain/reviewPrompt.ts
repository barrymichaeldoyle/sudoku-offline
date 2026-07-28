export const REVIEW_MIN_COMPLETIONS = 3;
export const REVIEW_MIN_SESSIONS = 2;
export const REVIEW_COOLDOWN_MS = 180 * 24 * 60 * 60 * 1000;

export type ReviewEligibilityInput = {
  completedGames: number;
  sessionCount: number;
  lastAttemptAt: string | null;
  now?: Date;
};

/**
 * Pure app-level eligibility. The OS still decides whether its native review
 * sheet appears, so an eligible request is recorded as an attempt, not a
 * confirmed presentation.
 */
export function isReviewPromptEligible({
  completedGames,
  sessionCount,
  lastAttemptAt,
  now = new Date(),
}: ReviewEligibilityInput): boolean {
  if (completedGames < REVIEW_MIN_COMPLETIONS || sessionCount < REVIEW_MIN_SESSIONS) {
    return false;
  }
  if (!lastAttemptAt) {
    return true;
  }
  const lastAttempt = new Date(lastAttemptAt).getTime();
  if (!Number.isFinite(lastAttempt)) {
    return true;
  }
  return now.getTime() - lastAttempt >= REVIEW_COOLDOWN_MS;
}
