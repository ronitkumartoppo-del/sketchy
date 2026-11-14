import { serializeProject } from "./document.ts";
import type { SketchyProject } from "./types.ts";

/** `original` is the imported bitmap. `edited` is the current mask and drawings. */
export type CompareView = "original" | "edited";
export type CompareLayout = "side" | "overlay";

export interface CompareSource {
  objectId: string;
  assetId: string;
  imageProjectId: string;
  boardName: string;
  label: string;
  width: number;
  height: number;
  drawingCount: number;
  hasMask: boolean;
}

export interface CompareSlot {
  objectId: string;
  view: CompareView;
}

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const COMPARISON_FILENAME = "comparison.png";
export const COMPARISON_EXPORT = { width: 1600, height: 900 } as const;

export function listCompareSources(project: SketchyProject): CompareSource[] {
  const sources: CompareSource[] = [];
  const used = new Map<string, number>();
  for (const board of project.boards) {
    for (const object of board.objects) {
      if (object.type !== "image") continue;
      const asset = project.assets[object.assetId];
      const edit = project.imageProjects[object.imageProjectId];
      const base = asset?.name?.trim() || "Image";
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      sources.push({
        objectId: object.id,
        assetId: object.assetId,
        imageProjectId: object.imageProjectId,
        boardName: board.name,
        label: count === 1 ? base : `${base} ${count}`,
        width: asset?.width && asset.width > 0 ? asset.width : object.width,
        height: asset?.height && asset.height > 0 ? asset.height : object.height,
        drawingCount: edit?.drawings.length ?? 0,
        hasMask: Boolean(edit?.mask),
      });
    }
  }
  return sources;
}

/** One image compares original against current marks. Two or more compare the first two current views. */
export function defaultComparePair(sources: readonly CompareSource[]): { a: CompareSlot; b: CompareSlot } | null {
  const first = sources[0];
  if (!first) return null;
  const second = sources[1];
  if (!second) {
    return {
      a: { objectId: first.objectId, view: "original" },
      b: { objectId: first.objectId, view: "edited" },
    };
  }
  return {
    a: { objectId: first.objectId, view: "edited" },
    b: { objectId: second.objectId, view: "edited" },
  };
}

export function findCompareSource(sources: readonly CompareSource[], objectId: string): CompareSource | undefined {
  return sources.find((source) => source.objectId === objectId);
}

export function slotLabel(source: CompareSource | undefined, view: CompareView): string {
  if (!source) return "Empty";
  return `${view === "original" ? "Original" : "Current"} · ${source.label}`;
}

/** Fit `src` inside `box`, centered. */
export function contain(srcW: number, srcH: number, box: FrameRect): FrameRect {
  if (srcW <= 0 || srcH <= 0 || box.w <= 0 || box.h <= 0) return { x: box.x, y: box.y, w: 0, h: 0 };
  const scale = Math.min(box.w / srcW, box.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export function compareStage(
  aW: number,
  aH: number,
  bW: number,
  bH: number,
  layout: CompareLayout,
  maxW: number,
  maxH: number,
  gap = 16,
): { width: number; height: number; a: FrameRect; b: FrameRect } {
  const width = Math.max(1, Math.floor(maxW));
  const height = Math.max(1, Math.floor(maxH));
  if (layout === "overlay") {
    const box = { x: 0, y: 0, w: width, h: height };
    return { width, height, a: contain(aW, aH, box), b: contain(bW, bH, box) };
  }
  const col = Math.max(1, (width - gap) / 2);
  return {
    width,
    height,
    a: contain(aW, aH, { x: 0, y: 0, w: col, h: height }),
    b: contain(bW, bH, { x: col + gap, y: 0, w: width - col - gap, h: height }),
  };
}

export function clampFade(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Opaque B drawn at `amount` over opaque A. 0 keeps A. 1 keeps B. */
export function overlayByte(base: number, cover: number, amount: number): number {
  const t = clampFade(amount);
  return Math.round(base + (cover - base) * t);
}

/** Listing pictures for Compare must not rewrite the project. */
export function compareReadsOnly(project: SketchyProject): boolean {
  const before = serializeProject(project);
  const sources = listCompareSources(project);
  defaultComparePair(sources);
  for (const source of sources) slotLabel(source, "edited");
  return serializeProject(project) === before;
}
