import { useRef } from "react";
import { clampAdjustments } from "../model/adjust";
import { defaultAdjustments } from "../model/document";
import { setImageAdjustments } from "../model/ops";
import type { Adjustments, SketchyProject } from "../model/types";
import { useSketchy } from "../store/use-sketchy";

export function AdjustBar({ editId, adjustments }: { editId: string; adjustments: Adjustments }) {
  const base = useRef<SketchyProject | null>(null);

  function preview(next: Adjustments) {
    const start = base.current ?? useSketchy.getState().history.present;
    base.current = start;
    useSketchy.getState().patch(() => setImageAdjustments(start, editId, clampAdjustments(next)));
  }

  function commit(next: Adjustments) {
    const clamped = clampAdjustments(next);
    const start = base.current;
    base.current = null;
    if (start) useSketchy.getState().patch(() => start);
    const current = (start ?? useSketchy.getState().history.present).imageProjects[editId]?.adjustments;
    if (current && JSON.stringify(current) === JSON.stringify(clamped)) return;
    useSketchy.getState().commit((project) => setImageAdjustments(project, editId, clamped));
  }

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2 overflow-x-auto border-t border-line bg-surface px-3 py-2">
      <Slider
        label="Brightness"
        min={-100}
        max={100}
        value={Math.round(adjustments.brightness * 100)}
        onPreview={(value) => preview({ ...adjustments, brightness: value / 100 })}
        onCommit={(value) => commit({ ...adjustments, brightness: value / 100 })}
      />
      <Slider
        label="Contrast"
        min={-100}
        max={100}
        value={Math.round(adjustments.contrast * 100)}
        onPreview={(value) => preview({ ...adjustments, contrast: value / 100 })}
        onCommit={(value) => commit({ ...adjustments, contrast: value / 100 })}
      />
      <Slider
        label="Color"
        min={-100}
        max={100}
        value={Math.round(adjustments.saturation * 100)}
        onPreview={(value) => preview({ ...adjustments, saturation: value / 100 })}
        onCommit={(value) => commit({ ...adjustments, saturation: value / 100 })}
      />
      <Slider
        label="Blur"
        min={0}
        max={24}
        value={Math.round(adjustments.blur)}
        onPreview={(value) => preview({ ...adjustments, blur: value })}
        onCommit={(value) => commit({ ...adjustments, blur: value })}
      />
      <Slider
        label="Pixelate"
        min={1}
        max={40}
        value={adjustments.pixelate}
        onPreview={(value) => preview({ ...adjustments, pixelate: value })}
        onCommit={(value) => commit({ ...adjustments, pixelate: value })}
      />
      <button
        type="button"
        className={"min-h-11 shrink-0 rounded-full px-3 text-sm " + (adjustments.grayscale ? "bg-ink text-paper" : "text-muted")}
        onClick={() => commit({ ...adjustments, grayscale: !adjustments.grayscale })}
      >
        Gray
      </button>
      <button
        type="button"
        className={"min-h-11 shrink-0 rounded-full px-3 text-sm " + (adjustments.flipX ? "bg-ink text-paper" : "text-muted")}
        onClick={() => commit({ ...adjustments, flipX: !adjustments.flipX })}
      >
        Flip
      </button>
      <button
        type="button"
        className="min-h-11 shrink-0 rounded-full px-3 text-sm text-muted"
        onClick={() => commit({ ...adjustments, rotation: adjustments.rotation + 90 })}
      >
        Rotate
      </button>
      <button
        type="button"
        className="min-h-11 shrink-0 rounded-full px-3 text-sm text-ink"
        onClick={() => commit(defaultAdjustments())}
      >
        Reset
      </button>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onPreview,
  onCommit,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="flex min-h-11 shrink-0 items-center gap-2 text-xs text-muted">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        className="w-24 accent-accent"
        onPointerDown={() => onPreview(value)}
        onInput={(event) => onPreview(Number(event.currentTarget.value))}
        onChange={(event) => onCommit(Number(event.currentTarget.value))}
        onPointerUp={(event) => onCommit(Number(event.currentTarget.value))}
      />
    </label>
  );
}
