/**
 * Daily-streak computation. Pure and React/DB-independent: callers pass the set
 * of calendar days on which the daily puzzle was completed plus "today", and we
 * derive the current and longest consecutive-day runs.
 *
 * Rules (per the spec): the current streak counts consecutive days ending on
 * today, or on yesterday if today's daily is not done yet (the streak is still
 * "alive"). If the most recent completion is older than yesterday, the current
 * streak is 0.
 */
const MS_PER_DAY = 86_400_000;

/** Whole days between the Unix epoch and a "YYYY-MM-DD" key (UTC-based, stable). */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export type Streak = {
  current: number;
  longest: number;
};

export function computeStreak(completedDateKeys: readonly string[], todayKey: string): Streak {
  if (completedDateKeys.length === 0) {
    return { current: 0, longest: 0 };
  }

  const days = Array.from(new Set(completedDateKeys.map(dayNumber))).sort((a, b) => a - b);

  // Longest run of consecutive calendar days.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) {
      longest = run;
    }
  }

  // Current run, only counted if it reaches today or yesterday.
  const today = dayNumber(todayKey);
  const last = days[days.length - 1];
  let current = 0;
  if (last === today || last === today - 1) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (days[i] === days[i - 1] + 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}
