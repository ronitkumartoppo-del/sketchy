import { normalizePoints, pointInPolygon, simplifyRdp } from "./geometry.ts";
import type { ImageMask } from "./types.ts";

export type CropMode = "remove-outside" | "remove-inside";

/** `keep` and `remove-outside` both hide pixels outside the shape. */
export function effectiveMaskMode(mask: ImageMask): CropMode {
  const mode = mask.kind === "rect" ? (mask.mode ?? "remove-outside") : mask.mode;
  return mode === "remove-inside" ? "remove-inside" : "remove-outside";
}

export function maskKeepsPixel(
  mask: ImageMask | null,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!mask || width <= 0 || height <= 0) return true;
  const inside =
    mask.kind === "rect"
      ? x >= mask.x * width &&
        y >= mask.y * height &&
        x <= (mask.x + mask.w) * width &&
        y <= (mask.y + mask.h) * height
      : pointInPolygon(x / width, y / height, mask.points);
  return effectiveMaskMode(mask) === "remove-inside" ? !inside : inside;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Lasso in source pixels → normalized polygon. Null if it is too small to be a crop. */
export function polygonMaskFromPixels(
  points: number[],
  width: number,
  height: number,
  mode: CropMode,
): ImageMask | null {
  if (width <= 0 || height <= 0 || points.length < 6) return null;
  const cleaned: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const x = clamp(points[i] ?? 0, 0, width);
    const y = clamp(points[i + 1] ?? 0, 0, height);
    const prevX = cleaned[cleaned.length - 2];
    const prevY = cleaned[cleaned.length - 1];
    if (prevX !== undefined && prevY !== undefined && Math.hypot(x - prevX, y - prevY) < 0.75) continue;
    cleaned.push(x, y);
  }
  if (cleaned.length < 6) return null;
  const ring = [...cleaned, cleaned[0]!, cleaned[1]!];
  const epsilon = Math.max(1, Math.min(width, height) * 0.004);
  const simplified = simplifyRdp(ring, epsilon);
  const open =
    simplified.length >= 4 &&
    simplified[0] === simplified[simplified.length - 2] &&
    simplified[1] === simplified[simplified.length - 1]
      ? simplified.slice(0, -2)
      : simplified;
  if (open.length < 6) return null;
  return { kind: "polygon", points: normalizePoints(open, width, height), mode };
}

export function rectMaskFromPixels(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number,
  mode: CropMode,
): ImageMask | null {
  if (width <= 0 || height <= 0) return null;
  const left = clamp(Math.min(x0, x1), 0, width);
  const top = clamp(Math.min(y0, y1), 0, height);
  const right = clamp(Math.max(x0, x1), 0, width);
  const bottom = clamp(Math.max(y0, y1), 0, height);
  if (right - left < 4 || bottom - top < 4) return null;
  return {
    kind: "rect",
    x: left / width,
    y: top / height,
    w: (right - left) / width,
    h: (bottom - top) / height,
    mode,
  };
}
