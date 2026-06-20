import type { ComponentProps, ComponentType } from "react";

import {
  ChartColumn,
  ChevronLeft,
  Cog,
  Eraser,
  Eye,
  House,
  Keyboard,
  Lightbulb,
  Pause,
  Play,
  Plus,
  Share2,
  StickyNote,
  Trophy,
  Undo2,
  X,
} from "lucide-react-native";

import { useCSSVariable } from "@/tw";

export type SimpleIconName =
  | "back"
  | "close"
  | "erase"
  | "eye"
  | "hint"
  | "home"
  | "input"
  | "notes"
  | "pause"
  | "play"
  | "plus"
  | "settings"
  | "share"
  | "stats"
  | "trophy"
  | "undo";

type SimpleIconProps = {
  name: SimpleIconName;
  tone?: "ink" | "muted" | "primary" | "onPrimary";
  size?: number;
};

type LucideComponent = ComponentType<ComponentProps<typeof Cog>>;

const ICONS: Record<SimpleIconName, LucideComponent> = {
  back: ChevronLeft,
  close: X,
  erase: Eraser,
  eye: Eye,
  hint: Lightbulb,
  home: House,
  input: Keyboard,
  notes: StickyNote,
  pause: Pause,
  play: Play,
  plus: Plus,
  settings: Cog,
  share: Share2,
  stats: ChartColumn,
  trophy: Trophy,
  undo: Undo2,
};

const COLOR_VARIABLES: Record<NonNullable<SimpleIconProps["tone"]>, string> = {
  ink: "--color-ink",
  muted: "--color-ink-soft",
  primary: "--color-primary",
  onPrimary: "--color-on-primary",
};

export function SimpleIcon({ name, tone = "muted", size = 17 }: SimpleIconProps) {
  const color = useCSSVariable(COLOR_VARIABLES[tone]);
  const Icon = ICONS[name];
  return <Icon color={color} size={size} strokeWidth={2.25} />;
}
