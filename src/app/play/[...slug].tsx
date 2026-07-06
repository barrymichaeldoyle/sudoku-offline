import type { DailyTrack } from "@/domain/daily";
import type { ParsedChallenge } from "@/domain/shareLink";
import type { Puzzle } from "@/domain/sudoku/types";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Linking, Platform } from "react-native";

import { AppMark } from "@/components/AppMark";
import { Screen } from "@/components/Screen";
import { getPuzzleById, getRandomPuzzleByDifficulty } from "@/data/repositories/puzzleRepository";
import { APP_SCHEME, parseChallengeRoute, STORE_URLS } from "@/domain/shareLink";
import { formatDuration } from "@/domain/time";
import { track } from "@/services/analyticsService";
import { getDailyPuzzle } from "@/services/dailyService";
import { launchPuzzle } from "@/services/gameLauncher";
import { useGameStore } from "@/state/useGameStore";
import { Pressable, Text, View } from "@/tw";

type PlayParams = {
  slug?: string | string[];
  t?: string | string[];
  m?: string | string[];
  d?: string | string[];
};

/**
 * Resolve a shared link to a concrete puzzle. A `puzzle` link is by id, with a
 * same-difficulty fallback for recipients on a different pack version; a
 * `daily`/`challenge` link is re-derived deterministically from its date so it
 * matches every install and needs no payload.
 */
async function resolveChallengePuzzle(parsed: ParsedChallenge): Promise<Puzzle | null> {
  if (parsed.kind === "puzzle") {
    const byId = await getPuzzleById(parsed.ref);
    if (byId) {
      return byId;
    }
    return parsed.difficulty ? getRandomPuzzleByDifficulty(parsed.difficulty) : null;
  }
  const track = parsed.kind === "challenge" ? "challenge" : "daily";
  return getDailyPuzzle(track, parsed.ref);
}

/**
 * Universal Link / App Link target for shared puzzle challenges
 * (`/play/<kind>/<ref>`). On native it loads the exact puzzle and drops the
 * player straight into it (carrying the sharer's time/mistakes as a target to
 * beat); on web it renders a DB-free landing page that routes to the App Store.
 *
 * Shared dailies/challenges open as a one-off puzzle — they never touch the
 * recipient's own streak or daily progress, which stay tied to *their* calendar.
 */
export default function PlayDeepLink() {
  const params = useLocalSearchParams<PlayParams>();

  if (Platform.OS === "web") {
    return <ChallengeLanding parsed={parseChallengeRoute(params)} />;
  }
  return <ChallengeLauncher params={params} />;
}

function ChallengeLauncher({ params }: { params: PlayParams }) {
  const router = useRouter();
  const setGame = useGameStore((s) => s.setGame);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) {
      return;
    }
    handled.current = true;

    const parsed = parseChallengeRoute(params);
    if (!parsed) {
      router.replace("/");
      return;
    }

    void (async () => {
      const puzzle = await resolveChallengePuzzle(parsed);
      if (!puzzle) {
        router.replace("/");
        return;
      }
      // One-off launch: no daily track progress, so a shared puzzle never alters
      // the recipient's own streak. Tag the game so labels and share text still
      // read as Daily Puzzle / Daily Challenge.
      const sharedDaily: { track: DailyTrack; dateKey: string } | undefined =
        parsed.kind === "daily" || parsed.kind === "challenge"
          ? { track: parsed.kind === "challenge" ? "challenge" : "daily", dateKey: parsed.ref }
          : undefined;
      const game = await launchPuzzle(() => Promise.resolve(puzzle), { sharedDaily });
      void track("challenge_link_opened", { kind: parsed.kind });
      if (!game) {
        router.replace("/");
        return;
      }
      setGame(game);
      const target: Record<string, string> = {};
      if (parsed.target.timeSeconds != null) {
        target.bt = String(parsed.target.timeSeconds);
      }
      if (parsed.target.mistakes != null) {
        target.bm = String(parsed.target.mistakes);
      }
      router.replace({ pathname: "/game/[gameId]", params: { gameId: game.id, ...target } });
    })();
  }, [params, router, setGame]);

  return (
    <Screen className="bg-canvas flex-1">
      <View className="flex-1 items-center justify-center gap-3">
        <ActivityIndicator />
        <Text className="text-ink-soft">Loading puzzle…</Text>
      </View>
    </Screen>
  );
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  extreme: "Extreme",
};

/** Web fallback for recipients without the app installed. Pure presentation —
 * never touches SQLite (unsupported on web). */
function ChallengeLanding({ parsed }: { parsed: ParsedChallenge | null }) {
  const chips: string[] = [];
  if (parsed) {
    if (parsed.kind === "challenge") {
      chips.push("Daily Challenge");
    } else if (parsed.kind === "daily") {
      chips.push("Daily Puzzle");
    } else if (parsed.difficulty) {
      chips.push(DIFFICULTY_LABELS[parsed.difficulty] ?? parsed.difficulty);
    }
    if (parsed.target.timeSeconds != null) {
      chips.push(`⏱ ${formatDuration(parsed.target.timeSeconds)}`);
    }
    if (parsed.target.mistakes != null) {
      chips.push(`❌ ${parsed.target.mistakes}`);
    }
  }

  const openInApp = () => {
    // Reconstruct the custom-scheme equivalent of the current URL so an installed
    // user who landed here anyway can still jump into the app.
    if (typeof window !== "undefined") {
      const { pathname, search } = window.location;
      void Linking.openURL(`${APP_SCHEME}://${pathname}${search}`);
    }
  };

  return (
    <Screen className="bg-canvas flex-1">
      <View className="flex-1 items-center justify-center gap-5 p-8">
        <AppMark size="lg" />
        <View className="items-center gap-2">
          <Text className="text-ink text-center text-2xl font-bold">
            You've been challenged to a Sudoku
          </Text>
          <Text className="text-ink-soft text-center text-base">
            Get Sudoku Offline to play this exact puzzle and try to beat their run.
          </Text>
        </View>

        {chips.length > 0 ? (
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            {chips.map((chip) => (
              <View
                key={chip}
                className="border-line bg-surface-muted rounded-full border px-3 py-1.5"
              >
                <Text className="text-ink text-sm font-semibold">{chip}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View className="w-full max-w-[360px] gap-3">
          <Pressable
            onPress={() => void Linking.openURL(STORE_URLS.ios)}
            accessibilityRole="button"
            accessibilityLabel="Download on the App Store"
            className="bg-primary items-center rounded-2xl py-4 active:opacity-80"
          >
            <Text className="text-on-primary text-lg font-semibold">Get it on the App Store</Text>
          </Pressable>
          <Pressable
            onPress={openInApp}
            accessibilityRole="button"
            accessibilityLabel="Open in the app"
            className="items-center py-2 active:opacity-70"
          >
            <Text className="text-ink-soft text-sm font-medium">Already have the app? Open it</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
