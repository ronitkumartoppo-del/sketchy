/** Canvas and document colors. CSS tokens in styles.css mirror the chrome set. */
export const palette = {
  paper: "#f3efe6",
  surface: "#fffdf8",
  ink: "#1a1814",
  muted: "#6f6a60",
  line: "#e3d9c8",
  dot: "#d9cfbf",
  accent: "#2347d6",
  note: "#ffe7a3",
  coral: "#e23d2b",
  moss: "#1f7a4d",
  gold: "#c9a227",
} as const;

export const DEFAULT_STROKE_WIDTH = 2.5;

export const SWATCHES: { id: string; value: string; label: string }[] = [
  { id: "none", value: "transparent", label: "None" },
  { id: "ink", value: palette.ink, label: "Ink" },
  { id: "cobalt", value: palette.accent, label: "Cobalt" },
  { id: "coral", value: palette.coral, label: "Coral" },
  { id: "moss", value: palette.moss, label: "Moss" },
  { id: "gold", value: palette.gold, label: "Gold" },
  { id: "note", value: palette.note, label: "Note" },
  { id: "paper", value: palette.surface, label: "Paper" },
];
