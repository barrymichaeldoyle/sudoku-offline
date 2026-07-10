import Svg, { Circle, Path } from "react-native-svg";

import { DIFFICULTY_COLOR_VAR, DIFFICULTY_LABELS } from "@/domain/sudoku/difficultyPresentation";
import { NEW_GAME_DIFFICULTIES, type Difficulty } from "@/domain/sudoku/types";
import { Text, useCSSVariable, View } from "@/tw";

/**
 * Donut of completed puzzles split by difficulty — the at-a-glance share view.
 * Exact counts and times live in the rows below it, which also act as the
 * legend (colour dot + label), so the ring itself carries no text. Segments
 * keep the fixed easy→expert order and are separated by a 2px gap of the card
 * surface showing through; a lone difficulty renders as a full ring.
 */
export function DifficultyDonut({
  completedByDifficulty,
  size,
}: {
  completedByDifficulty: Record<Difficulty, number>;
  size: number;
}) {
  // One hook call per difficulty (fixed set, stable order) so the ring
  // recolours reactively when the theme flips.
  const colors: Record<string, string> = {
    easy: useCSSVariable(DIFFICULTY_COLOR_VAR.easy),
    medium: useCSSVariable(DIFFICULTY_COLOR_VAR.medium),
    hard: useCSSVariable(DIFFICULTY_COLOR_VAR.hard),
    expert: useCSSVariable(DIFFICULTY_COLOR_VAR.expert),
  };

  const filled = NEW_GAME_DIFFICULTIES.filter((d) => completedByDifficulty[d] > 0);
  const total = filled.reduce((sum, d) => sum + completedByDifficulty[d], 0);
  if (total === 0) return null;

  const strokeWidth = Math.round(size / 9);
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  // 2px of surface between neighbouring segments, expressed as arc angle.
  const padAngle = filled.length > 1 ? 2 / radius : 0;

  const arcs: { difficulty: Difficulty; d: string }[] = [];
  let cumulative = 0;
  for (const difficulty of filled) {
    const fraction = completedByDifficulty[difficulty] / total;
    // Start at 12 o'clock, sweep clockwise.
    let start = -Math.PI / 2 + cumulative * 2 * Math.PI + padAngle / 2;
    let end = -Math.PI / 2 + (cumulative + fraction) * 2 * Math.PI - padAngle / 2;
    cumulative += fraction;
    // Keep a 1-of-many sliver visible instead of letting the gap swallow it.
    if (end - start < padAngle) end = start + padAngle;
    const x0 = center + radius * Math.cos(start);
    const y0 = center + radius * Math.sin(start);
    const x1 = center + radius * Math.cos(end);
    const y1 = center + radius * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    arcs.push({
      difficulty,
      d: `M ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1}`,
    });
  }

  const summary = filled
    .map((d) => `${DIFFICULTY_LABELS[d]} ${completedByDifficulty[d]}`)
    .join(", ");

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Completed by difficulty: ${summary}`}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        {filled.length === 1 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors[filled[0]]}
            strokeWidth={strokeWidth}
            fill="none"
          />
        ) : (
          arcs.map(({ difficulty, d }) => (
            <Path
              key={difficulty}
              d={d}
              stroke={colors[difficulty]}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              fill="none"
            />
          ))
        )}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-ink text-3xl font-bold">{total}</Text>
        <Text className="text-ink-soft text-xs">solved</Text>
      </View>
    </View>
  );
}
