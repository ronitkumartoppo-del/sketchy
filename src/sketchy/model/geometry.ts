import type { BoardObject, Camera } from "./types.ts";

export interface Point {
  x: number;
  y: number;
}

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function screenToWorld(camera: Camera, screen: Point): Point {
  return {
    x: (screen.x - camera.x) / camera.scale,
    y: (screen.y - camera.y) / camera.scale,
  };
}

/** Zoom around a screen point so the world point under the cursor stays put. */
export function zoomBy(camera: Camera, screen: Point, factor: number): Camera {
  const scale = clamp(camera.scale * factor, MIN_SCALE, MAX_SCALE);
  const world = screenToWorld(camera, screen);
  return {
    scale,
    x: screen.x - world.x * scale,
    y: screen.y - world.y * scale,
  };
}

export function zoomAt(camera: Camera, screen: Point, deltaY: number): Camera {
  const factor = deltaY > 0 ? 1 / 1.06 : 1.06;
  return zoomBy(camera, screen, factor);
}

export function pointInPolygon(x: number, y: number, points: number[]): boolean {
  let inside = false;
  const count = Math.floor(points.length / 2);
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = points[i * 2] ?? 0;
    const yi = points[i * 2 + 1] ?? 0;
    const xj = points[j * 2] ?? 0;
    const yj = points[j * 2 + 1] ?? 0;
    const crosses = yi > y !== yj > y;
    if (crosses && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function normalizePoints(points: number[], width: number, height: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push((points[i] ?? 0) / width, (points[i + 1] ?? 0) / height);
  }
  return out;
}

export function denormalizePoints(points: number[], width: number, height: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push((points[i] ?? 0) * width, (points[i + 1] ?? 0) * height);
  }
  return out;
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length;
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points.slice();
  let maxDist = 0;
  let index = 0;
  const start = points[0]!;
  const end = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i]!, start, end);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [start, end];
}

/** Ramer–Douglas–Peucker. `points` is a flat x,y list. Closed rings stay closed. */
export function simplifyRdp(points: number[], epsilon: number): number[] {
  if (points.length < 6) return points.slice();
  const pairs: Point[] = [];
  for (let i = 0; i < points.length; i += 2) {
    pairs.push({ x: points[i] ?? 0, y: points[i + 1] ?? 0 });
  }
  const closed =
    pairs.length > 2 &&
    pairs[0]!.x === pairs[pairs.length - 1]!.x &&
    pairs[0]!.y === pairs[pairs.length - 1]!.y;
  const open = closed ? pairs.slice(0, -1) : pairs;
  const simplified = rdp(open, epsilon);
  if (closed) simplified.push({ ...simplified[0]! });
  return simplified.flatMap((p) => [p.x, p.y]);
}

export function scaledPoints(points: number[], sx: number, sy: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push((points[i] ?? 0) * sx, (points[i + 1] ?? 0) * sy);
  }
  return out;
}

export function bakeBoardTransform(
  obj: BoardObject,
  t: { x: number; y: number; rotation: number; scaleX: number; scaleY: number },
): BoardObject {
  const place = { x: t.x, y: t.y, rotation: t.rotation };
  switch (obj.type) {
    case "rect":
    case "ellipse":
    case "note":
    case "image":
      return {
        ...obj,
        ...place,
        width: Math.max(8, obj.width * Math.abs(t.scaleX)),
        height: Math.max(8, obj.height * Math.abs(t.scaleY)),
      };
    case "text":
      return {
        ...obj,
        ...place,
        width: Math.max(16, obj.width * Math.abs(t.scaleX)),
        fontSize: Math.max(8, obj.fontSize * Math.abs(t.scaleY)),
      };
    case "pen":
    case "arrow":
      return { ...obj, ...place, points: scaledPoints(obj.points, t.scaleX, t.scaleY) };
  }
}
