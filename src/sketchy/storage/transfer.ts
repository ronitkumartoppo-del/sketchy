import { collectAssetIds, missingAssetIds } from "../model/document";
import { useSketchy } from "../store/use-sketchy";
import { idbGetBlob, idbPutBlob } from "./idb";
import { packSketchy, sketchyFilename, unpackSketchy } from "./sketchy-file";

export async function downloadCurrentProject(): Promise<{ missing: string[] }> {
  const project = useSketchy.getState().history.present;
  const blobs = new Map<string, Blob>();
  for (const id of collectAssetIds(project)) {
    const blob = await idbGetBlob(id);
    if (blob) blobs.set(id, blob);
  }
  const packed = await packSketchy(project, blobs);
  const url = URL.createObjectURL(packed);
  const link = document.createElement("a");
  link.href = url;
  link.download = sketchyFilename(project.name);
  link.click();
  URL.revokeObjectURL(url);
  return { missing: missingAssetIds(project, new Set(blobs.keys())) };
}

/** Replaces the browser session. Blobs are written before the project JSON. */
export async function openSketchyFile(file: Blob): Promise<{ name: string; missing: string[] }> {
  const opened = await unpackSketchy(await file.arrayBuffer());
  for (const [id, blob] of opened.files) await idbPutBlob(id, blob);
  const previous = useSketchy.getState().assetUrls;
  for (const url of Object.values(previous)) URL.revokeObjectURL(url);
  const urls: Record<string, string> = {};
  for (const [id, blob] of opened.files) urls[id] = URL.createObjectURL(blob);
  useSketchy.getState().hydrate(opened.project, urls);
  return { name: opened.project.name, missing: opened.missing };
}
