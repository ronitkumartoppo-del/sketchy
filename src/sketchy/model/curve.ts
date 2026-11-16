import type { Point } from "./geometry.ts";

/** Start, two controls, and end, relative to the object origin.
 * The controls sit off the straight chord so the drag reads as a curve.
 */
export function curvePoints(end: Point): number[] {
  const dx = end.x;
  const dy = end.y;
  const len = Math.hypot(dx, dy);
  const bow = len * 0.35;
  const px = len === 0 ? 0 : (-dy / len) * bow;
  const py = len === 0 ? 0 : (dx / len) * bow;
  return [0, 0, dx / 3 + px, dy / 3 + py, (2 * dx) / 3 + px, (2 * dy) / 3 + py, dx, dy];
}

export function cubicPoint(points: readonly number[], t: number): Point {
  const x0 = points[0] ?? 0;
  const y0 = points[1] ?? 0;
  const x1 = points[2] ?? 0;
  const y1 = points[3] ?? 0;
  const x2 = points[4] ?? 0;
  const y2 = points[5] ?? 0;
  const x3 = points[6] ?? 0;
  const y3 = points[7] ?? 0;
  const u = 1 - t;
  return {
    x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
    y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
  };
}
