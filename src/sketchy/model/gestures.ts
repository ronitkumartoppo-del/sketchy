import { MIN_SCALE, MAX_SCALE, clamp, screenToWorld, type Point } from "./geometry.ts";
import type { Camera } from "./types.ts";

export interface Pinch {
  lastDistance: number;
  lastCenter: Point;
}

/** Two pointers cancel a one-finger stroke and start a pinch. */
export function pinchFrom(points: readonly Point[]): Pinch | null {
  if (points.length < 2) return null;
  const a = points[0]!;
  const b = points[1]!;
  const lastDistance = Math.hypot(a.x - b.x, a.y - b.y);
  if (lastDistance <= 0) return null;
  return { lastDistance, lastCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}

/** Keep the world point under the old midpoint under the new midpoint, and scale by the distance change. */
export function pinchMove(camera: Camera, pinch: Pinch, points: readonly Point[]): { camera: Camera; pinch: Pinch } | null {
  const next = pinchFrom(points);
  if (!next) return null;
  const world = screenToWorld(camera, pinch.lastCenter);
  const scale = clamp(camera.scale * (next.lastDistance / pinch.lastDistance), MIN_SCALE, MAX_SCALE);
  return {
    camera: {
      scale,
      x: next.lastCenter.x - world.x * scale,
      y: next.lastCenter.y - world.y * scale,
    },
    pinch: next,
  };
}
