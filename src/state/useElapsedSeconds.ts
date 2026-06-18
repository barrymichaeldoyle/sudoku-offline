import { useEffect, useState } from "react";

import { useGameStore } from "./useGameStore";

/** Live elapsed seconds: committed time plus the current running segment. */
export function useElapsedSeconds(): number {
  const committed = useGameStore((s) => s.game?.elapsedSeconds ?? 0);
  const running = useGameStore((s) => s.running);
  const lastStartedAt = useGameStore((s) => s.lastStartedAt);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (running && lastStartedAt != null) {
    return committed + Math.floor((Date.now() - lastStartedAt) / 1000);
  }
  return committed;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
