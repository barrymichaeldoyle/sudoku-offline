import { AppState } from "react-native";

import {
  loadReviewPromptState,
  saveReviewPromptState,
} from "@/data/repositories/settingsRepository";
import { getCompletedGameCount } from "@/data/repositories/statsRepository";
import { isReviewPromptEligible } from "@/domain/reviewPrompt";
import { track } from "@/services/analyticsService";

const POST_COMPLETION_DELAY_MS = 1_000;
const SENSITIVE_FLOW_COOLDOWN_MS = 60_000;

let requestedThisSession = false;
let sessionRecorded = false;
let suppressedUntil = 0;

/** Count one app process as one session. Called once by initializeApp. */
export async function recordReviewSession(): Promise<void> {
  if (sessionRecorded) {
    return;
  }
  const state = await loadReviewPromptState();
  await saveReviewPromptState({
    ...state,
    sessionCount: state.sessionCount + 1,
  });
  sessionRecorded = true;
}

/**
 * Prevent a rating request immediately after a rewarded ad or purchase flow.
 * The next successful completion after the short cooldown may try again.
 */
export function suppressReviewPromptTemporarily(durationMs = SENSITIVE_FLOW_COOLDOWN_MS): void {
  suppressedUntil = Math.max(suppressedUntil, Date.now() + durationMs);
}

/**
 * Best-effort native request after an eligible completion. There is no custom
 * pre-prompt and no result to inspect. The platform may silently suppress it.
 */
export async function maybeRequestReview(): Promise<boolean> {
  if (requestedThisSession || Date.now() < suppressedUntil || process.env.EXPO_OS === "web") {
    return false;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, POST_COMPLETION_DELAY_MS);
  });

  if (requestedThisSession || Date.now() < suppressedUntil || AppState.currentState !== "active") {
    return false;
  }

  try {
    // Resolve the native module only when an attempt is possible. Besides
    // keeping startup lean, this lets an older OTA binary that predates
    // expo-store-review safely skip the request instead of crashing on import.
    const StoreReview = await import("expo-store-review");
    const [state, completedGames, available, hasAction] = await Promise.all([
      loadReviewPromptState(),
      getCompletedGameCount(),
      StoreReview.isAvailableAsync(),
      StoreReview.hasAction(),
    ]);
    if (
      !available ||
      !hasAction ||
      !isReviewPromptEligible({
        completedGames,
        sessionCount: state.sessionCount,
        lastAttemptAt: state.lastAttemptAt,
      })
    ) {
      return false;
    }

    requestedThisSession = true;
    await saveReviewPromptState({
      ...state,
      lastAttemptAt: new Date().toISOString(),
    });
    void track("review_prompt_attempted", { completedGames });
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

export type DevelopmentReviewResult = "requested" | "unavailable" | "failed" | "disabled";

/**
 * Dev-only native smoke test. It deliberately bypasses app eligibility and
 * does not mutate the production cooldown, so testing never changes real
 * prompting behavior. The OS may still suppress the sheet.
 */
export async function requestReviewForDevelopment(): Promise<DevelopmentReviewResult> {
  if (!__DEV__) {
    return "disabled";
  }
  try {
    const StoreReview = await import("expo-store-review");
    const [available, hasAction] = await Promise.all([
      StoreReview.isAvailableAsync(),
      StoreReview.hasAction(),
    ]);
    if (!available || !hasAction) {
      return "unavailable";
    }
    await StoreReview.requestReview();
    return "requested";
  } catch {
    return "failed";
  }
}
