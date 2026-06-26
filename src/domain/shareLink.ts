import { DIFFICULTIES, type Difficulty } from "@/domain/sudoku/types";
import { formatDuration } from "@/domain/time";

/**
 * Host that serves the Universal Link / App Link landing page *and* the
 * `apple-app-site-association` + `assetlinks.json` verification files. This is
 * the free EAS Hosting subdomain — `eas deploy` publishes the web build (and
 * everything in `public/`) here. If the app ever moves to a custom domain,
 * change this one constant and the matching `associatedDomains` /
 * `intentFilters` entries in `app.json`.
 */
const LINK_HOST = "sudokuoffline.expo.app";
export const LINK_ORIGIN = `https://${LINK_HOST}`;

/** Custom scheme, kept as a fallback for surfaces that strip https links. */
export const APP_SCHEME = "sudokuoffline";

/** Where the app lives on each store — the not-installed call-to-action. */
export const STORE_URLS = {
  ios: "https://apps.apple.com/app/id6782209083",
  // TODO: add `android` once we launch on the Play Store:
  // "https://play.google.com/store/apps/details?id=com.barrymichaeldoyle.sudokuoffline"
} as const;

/**
 * A shared puzzle either points at a specific bundled puzzle (`puzzle`) or at a
 * daily/challenge slot, which the recipient re-derives deterministically from
 * the date so it works fully offline and matches every install.
 */
export type ChallengeKind = "puzzle" | "daily" | "challenge";

/** Short URL segment per kind, also the apple-app-site-association prefix. */
const KIND_SEGMENT: Record<ChallengeKind, string> = {
  puzzle: "p",
  daily: "d",
  challenge: "c",
};
const SEGMENT_KIND: Record<string, ChallengeKind> = {
  p: "puzzle",
  d: "daily",
  c: "challenge",
};

export type ShareLinkInput = {
  kind: ChallengeKind;
  /** Puzzle id for `puzzle`, calendar date key for `daily`/`challenge`. */
  ref: string;
  /**
   * Carried for `puzzle` so a recipient whose bundled pack version differs (and
   * therefore lacks this exact id) can still fall back to a fresh puzzle of the
   * same difficulty.
   */
  difficulty?: Difficulty | null;
  /** Time to beat, in seconds. Omitted when the sharer hides the timer. */
  timeSeconds?: number | null;
  /** Mistakes to beat. Omitted when the sharer hides mistake checking. */
  mistakes?: number | null;
};

function nonNegativeInt(value: number): number {
  return Math.max(0, Math.floor(value));
}

/** Build the https Universal Link for a shared puzzle/challenge. */
export function buildShareLink(input: ShareLinkInput): string {
  const segment = KIND_SEGMENT[input.kind];
  const query: string[] = [];
  if (input.timeSeconds != null) {
    query.push(`t=${nonNegativeInt(input.timeSeconds)}`);
  }
  if (input.mistakes != null) {
    query.push(`m=${nonNegativeInt(input.mistakes)}`);
  }
  if (input.kind === "puzzle" && input.difficulty) {
    query.push(`d=${input.difficulty}`);
  }
  const suffix = query.length > 0 ? `?${query.join("&")}` : "";
  return `${LINK_ORIGIN}/play/${segment}/${encodeURIComponent(input.ref)}${suffix}`;
}

/** The "beat this" target a recipient sees, derived from the sharer's result. */
export type ChallengeTarget = {
  timeSeconds: number | null;
  mistakes: number | null;
};

export type ParsedChallenge = {
  kind: ChallengeKind;
  ref: string;
  difficulty: Difficulty | null;
  target: ChallengeTarget;
};

const DIFFICULTY_SET: ReadonlySet<string> = new Set(DIFFICULTIES);

/** First value of an expo-router param, which may arrive as a repeated array. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCount(value: string | string[] | undefined): number | null {
  const raw = first(value);
  if (raw == null) {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Turn the deep-link route params (`/play/[...slug]` + query) into a launch
 * intent, or null when the link is malformed. Pure so the routing layer stays a
 * thin shell over a tested parser.
 */
export function parseChallengeRoute(params: {
  slug?: string | string[];
  t?: string | string[];
  m?: string | string[];
  d?: string | string[];
}): ParsedChallenge | null {
  const slug = Array.isArray(params.slug) ? params.slug : params.slug ? [params.slug] : [];
  const [segment, rawRef] = slug;
  const kind = segment ? SEGMENT_KIND[segment] : undefined;
  if (!kind || !rawRef) {
    return null;
  }
  const difficulty = first(params.d);
  return {
    kind,
    ref: decodeURIComponent(rawRef),
    difficulty: difficulty && DIFFICULTY_SET.has(difficulty) ? (difficulty as Difficulty) : null,
    target: {
      timeSeconds: parseCount(params.t),
      mistakes: parseCount(params.m),
    },
  };
}

/**
 * One-line, friendly verdict comparing the player's run to the challenge target,
 * shown on the completion screen. Time wins the comparison when both runs have a
 * time; otherwise it falls back to mistakes. Returns null when there's nothing
 * comparable (e.g. the player has the timer and mistake checking both off).
 */
export function describeChallengeOutcome(
  target: ChallengeTarget,
  result: ChallengeTarget,
): string | null {
  if (target.timeSeconds != null && result.timeSeconds != null) {
    const diff = result.timeSeconds - target.timeSeconds;
    if (diff < 0) {
      return `🏅 You beat their time by ${formatDuration(-diff)}!`;
    }
    if (diff === 0) {
      return `🤝 Dead heat with their ${formatDuration(target.timeSeconds)}.`;
    }
    return `⏱ ${formatDuration(diff)} short of their ${formatDuration(target.timeSeconds)}. Run it back!`;
  }
  if (target.mistakes != null && result.mistakes != null) {
    if (result.mistakes < target.mistakes) {
      return "🏅 Fewer mistakes than them. Clean run!";
    }
    if (result.mistakes === target.mistakes) {
      return `🤝 Matched their ${target.mistakes} mistakes.`;
    }
    return `They had ${target.mistakes}, you had ${result.mistakes}. Run it back!`;
  }
  return null;
}
