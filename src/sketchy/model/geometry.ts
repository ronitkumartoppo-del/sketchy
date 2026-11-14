import type { BoardObject, Camera, DrawingObject, FrameObject, GroupObject } from "./types.ts";

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
    case "group":
    case "frame":
      return {
        ...obj,
        ...place,
        width: Math.max(8, obj.width * Math.abs(t.scaleX)),
        height: Math.max(8, obj.height * Math.abs(t.scaleY)),
      };
    case "connector":
      return { ...obj, ...place };
  }
}

/** Bake a Konva transform into source-image pixel space. Does not touch the asset. */
export function bakeDrawingTransform(
  drawing: DrawingObject,
  t: { x: number; y: number; rotation: number; scaleX: number; scaleY: number },
): DrawingObject {
  const place = { x: t.x, y: t.y, rotation: t.rotation };
  const sx = Math.abs(t.scaleX);
  const sy = Math.abs(t.scaleY);
  if (drawing.kind === "rect" || drawing.kind === "ellipse") {
    return {
      ...drawing,
      ...place,
      width: Math.max(4, (drawing.width ?? 0) * sx),
      height: Math.max(4, (drawing.height ?? 0) * sy),
    };
  }
  if (drawing.kind === "text") {
    return {
      ...drawing,
      ...place,
      width: Math.max(12, (drawing.width ?? 40) * sx),
      fontSize: Math.max(8, (drawing.fontSize ?? 28) * sy),
    };
  }
  return { ...drawing, ...place, points: scaledPoints(drawing.points ?? [], t.scaleX, t.scaleY) };
}

export type Box = { x: number; y: number; w: number; h: number };

/** Bounds in the object's parent space. */
export function boundsOf(object: BoardObject): Box {
  switch (object.type) {
    case "rect":
    case "ellipse":
    case "note":
    case "image":
    case "frame":
    case "group":
      return { x: object.x, y: object.y, w: object.width, h: object.height };
    case "text":
      return { x: object.x, y: object.y, w: object.width, h: Math.max(8, object.fontSize * 1.25) };
    case "pen":
    case "arrow": {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < object.points.length; i += 2) {
        const x = object.points[i] ?? 0;
        const y = object.points[i + 1] ?? 0;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (!Number.isFinite(minX)) return { x: object.x, y: object.y, w: 1, h: 1 };
      return {
        x: object.x + minX,
        y: object.y + minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
      };
    }
    case "connector":
      return { x: object.x, y: object.y, w: 0, h: 0 };
  }
}

export function findParent(objects: readonly BoardObject[], id: string): GroupObject | FrameObject | undefined {
  for (const object of objects) {
    if ((object.type === "group" || object.type === "frame") && object.childIds.includes(id)) return object;
  }
  return undefined;
}

export function rootObjects(objects: readonly BoardObject[]): BoardObject[] {
  const nested = new Set<string>();
  for (const object of objects) {
    if (object.type === "group" || object.type === "frame") {
      for (const childId of object.childIds) nested.add(childId);
    }
  }
  return objects.filter((object) => !nested.has(object.id));
}

export function liftPoint(parent: { x: number; y: number; rotation: number }, point: Point): Point {
  const rad = (parent.rotation * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: parent.x + point.x * c - point.y * s,
    y: parent.y + point.x * s + point.y * c,
  };
}

export function unliftPoint(parent: { x: number; y: number; rotation: number }, world: Point): Point {
  const dx = world.x - parent.x;
  const dy = world.y - parent.y;
  const rad = (-parent.rotation * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

export function worldOrigin(objects: readonly BoardObject[], id: string): Point | null {
  const object = objects.find((item) => item.id === id);
  if (!object) return null;
  let point = { x: object.x, y: object.y };
  let parent = findParent(objects, id);
  while (parent) {
    point = liftPoint(parent, point);
    parent = findParent(objects, parent.id);
  }
  return point;
}

export function worldCenter(objects: readonly BoardObject[], id: string): Point | null {
  const object = objects.find((item) => item.id === id);
  if (!object || object.type === "connector") return null;
  const box = boundsOf(object);
  let point = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  let parent = findParent(objects, id);
  while (parent) {
    point = liftPoint(parent, point);
    parent = findParent(objects, parent.id);
  }
  return point;
}

export function containsInFrame(frame: FrameObject, point: Point): boolean {
  const local = unliftPoint(frame, point);
  return local.x >= 0 && local.y >= 0 && local.x <= frame.width && local.y <= frame.height;
}

