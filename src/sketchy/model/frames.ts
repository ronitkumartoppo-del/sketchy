export const FRAME_PRESETS = [
  { id: "story", name: "Story", width: 270, height: 480 },
  { id: "square", name: "Square", width: 400, height: 400 },
  { id: "wide", name: "Wide", width: 480, height: 270 },
] as const;

export type FramePresetId = (typeof FRAME_PRESETS)[number]["id"];

export function framePreset(id: FramePresetId): (typeof FRAME_PRESETS)[number] {
  return FRAME_PRESETS.find((preset) => preset.id === id) ?? FRAME_PRESETS[0];
}
