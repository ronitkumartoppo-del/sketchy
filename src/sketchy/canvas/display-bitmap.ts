import { displayPixelSize, needsDisplayBitmap } from "../model/display";
import type { SketchyProject } from "../model/types";
import { useSketchy } from "../store/use-sketchy";
import { idbGetBlob } from "../storage/idb";

/** A smaller object URL for the board. Null when the file is already small. The original blob is not changed. */
export async function displayObjectUrl(blob: Blob, width: number, height: number): Promise<string | null> {
  if (!needsDisplayBitmap(width, height) || typeof document === "undefined") return null;
  const fitted = displayPixelSize(width, height);
  const bitmap = await createImageBitmap(blob, { resizeWidth: fitted.width, resizeHeight: fitted.height });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const small = await new Promise<Blob | null>((resolve) => canvas.toBlob((next) => resolve(next), "image/png"));
    return small ? URL.createObjectURL(small) : null;
  } finally {
    bitmap.close();
  }
}

export async function fillDisplayUrls(project: SketchyProject): Promise<void> {
  const next: Record<string, string> = {};
  for (const asset of Object.values(project.assets)) {
    if (!needsDisplayBitmap(asset.width, asset.height)) continue;
    const blob = await idbGetBlob(asset.id);
    if (!blob) continue;
    const url = await displayObjectUrl(blob, asset.width, asset.height);
    if (url) next[asset.id] = url;
  }
  if (Object.keys(next).length === 0) return;
  const current = useSketchy.getState().displayUrls;
  for (const url of Object.values(current)) URL.revokeObjectURL(url);
  useSketchy.getState().replaceDisplayUrls(next);
}
