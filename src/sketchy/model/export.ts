import { findParent, unliftPoint, worldCenter, type Point } from "./geometry.ts";
import type { BoardObject } from "./types.ts";

/** Names of pictures. None of these is a .sketchy project. */
export const PICTURE_FILES = {
  view: "sketchy-view.png",
  image: "sketchy-image.png",
  frame: "sketchy-frame.png",
} as const;

/** The saved image uses the original pixel size, not the size of the board object. */
export function imageExportPixels(asset: { width: number; height: number }): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(asset.width)),
    height: Math.max(1, Math.round(asset.height)),
  };
}

/** A frame picture is the artboard, twice as sharp, not the zoomed view on screen. */
export function frameExportPixels(
  frame: { width: number; height: number },
  ratio = 2,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(frame.width * ratio)),
    height: Math.max(1, Math.round(frame.height * ratio)),
  };
}

export interface FrameConnectorLine {
  id: string;
  from: Point;
  to: Point;
  stroke: string;
  strokeWidth: number;
}

function frameOwns(objects: readonly BoardObject[], frameId: string, id: string): boolean {
  let parent = findParent(objects, id);
  while (parent) {
    if (parent.id === frameId) return true;
    parent = findParent(objects, parent.id);
  }
  return false;
}

function worldToLocal(objects: readonly BoardObject[], id: string, world: Point): Point {
  const chain: BoardObject[] = [];
  let current = objects.find((item) => item.id === id);
  while (current) {
    chain.push(current);
    current = findParent(objects, current.id);
  }
  let point = world;
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    point = unliftPoint(chain[index]!, point);
  }
  return point;
}

/** Connectors that touch this frame, in the frame's own coordinates. */
export function connectorsForFrame(objects: readonly BoardObject[], frameId: string): FrameConnectorLine[] {
  const frame = objects.find((item) => item.id === frameId);
  if (!frame || frame.type !== "frame") return [];
  const lines: FrameConnectorLine[] = [];
  for (const object of objects) {
    if (object.type !== "connector") continue;
    if (!frameOwns(objects, frameId, object.fromId) && !frameOwns(objects, frameId, object.toId)) continue;
    const from = worldCenter(objects, object.fromId);
    const to = worldCenter(objects, object.toId);
    if (!from || !to) continue;
    lines.push({
      id: object.id,
      from: worldToLocal(objects, frameId, from),
      to: worldToLocal(objects, frameId, to),
      stroke: object.stroke,
      strokeWidth: object.strokeWidth,
    });
  }
  return lines;
}
