import { clsx } from "clsx";

import { View } from "@/tw";

const APP_MARK_CELL = { sm: "h-5 w-5", md: "h-6 w-6", lg: "h-9 w-9" } as const;

/**
 * Brand mark: a mini Sudoku board with an indigo grid and one gold cell
 * (top-right), mirroring the app icon (see scripts/generate-icons.mjs). Drawn
 * with theme tokens so it adapts to light/dark rather than baking the icon PNG —
 * use this instead of the static icon image wherever the mark appears in-app.
 */
export function AppMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <View className="border-primary bg-surface overflow-hidden rounded-2xl border-2">
      {[0, 1, 2].map((r) => (
        <View key={r} className="flex-row">
          {[0, 1, 2].map((c) => (
            <View
              key={c}
              className={clsx(
                APP_MARK_CELL[size],
                c < 2 && "border-primary border-r",
                r < 2 && "border-primary border-b",
                r === 0 && c === 2 ? "bg-warning" : "bg-surface",
              )}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
