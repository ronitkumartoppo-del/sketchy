import { defaultAdjustments } from "./document.ts";
import type { Adjustments, ImageMask } from "./types.ts";

export function adjustmentsAreDefault(adjustments: Adjustments): boolean {
  const base = defaultAdjustments();
  return (
    adjustments.brightness === base.brightness &&
    adjustments.contrast === base.contrast &&
    adjustments.saturation === base.saturation &&
    adjustments.grayscale === base.grayscale &&
    adjustments.blur === base.blur &&
    adjustments.pixelate === base.pixelate &&
    adjustments.rotation === base.rotation &&
    adjustments.flipX === base.flipX &&
    adjustments.flipY === base.flipY
  );
}

export function viewNeedsComposite(adjustments: Adjustments | undefined, mask: ImageMask | null): boolean {
  return Boolean(mask) || (adjustments ? !adjustmentsAreDefault(adjustments) : false);
}

/** CSS filter for the color controls. Null means draw the bitmap unchanged. Flip, rotation, and pixelate are not filters. */
export function colorFilter(adjustments: Adjustments): string | null {
  const parts: string[] = [];
  if (adjustments.brightness !== 0) parts.push(`brightness(${1 + adjustments.brightness})`);
  if (adjustments.contrast !== 0) parts.push(`contrast(${1 + adjustments.contrast})`);
  if (adjustments.saturation !== 0) parts.push(`saturate(${1 + adjustments.saturation})`);
  if (adjustments.grayscale) parts.push("grayscale(1)");
  if (adjustments.blur > 0) parts.push(`blur(${adjustments.blur}px)`);
  return parts.length > 0 ? parts.join(" ") : null;
}

export function clampAdjustments(adjustments: Adjustments): Adjustments {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return {
    brightness: clamp(adjustments.brightness, -1, 1),
    contrast: clamp(adjustments.contrast, -1, 1),
    saturation: clamp(adjustments.saturation, -1, 1),
    grayscale: adjustments.grayscale,
    blur: clamp(adjustments.blur, 0, 40),
    pixelate: clamp(Math.round(adjustments.pixelate), 1, 80),
    rotation: ((adjustments.rotation % 360) + 360) % 360,
    flipX: adjustments.flipX,
    flipY: adjustments.flipY,
  };
}
