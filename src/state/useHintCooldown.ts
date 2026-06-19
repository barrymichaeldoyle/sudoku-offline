import { useEffect, useState } from "react";

import { useGameStore } from "./useGameStore";

function secondsUntil(until: number | null): number {
  if (until == null) {
    return 0;
  }
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

/**
 * Seconds left on the hint cooldown (0 when the Hint button is ready). Ticks
 * itself down while active and stops once it reaches zero.
 */
export function useHintCooldownRemaining(): number {
  const until = useGameStore((s) => s.hintCooldownUntil);
  const [remaining, setRemaining] = useState(() => secondsUntil(until));

  useEffect(() => {
    setRemaining(secondsUntil(until));
    if (until == null) {
      return;
    }
    const id = setInterval(() => {
      const next = secondsUntil(until);
      setRemaining(next);
      if (next <= 0) {
        clearInterval(id);
      }
    }, 250);
    return () => clearInterval(id);
  }, [until]);

  return remaining;
}
