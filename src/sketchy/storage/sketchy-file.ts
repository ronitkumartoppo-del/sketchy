import JSZip from "jszip";
import { collectAssetIds, missingAssetIds, parseProject, serializeProject } from "../model/document.ts";
import type { SketchyProject } from "../model/types.ts";

export interface SketchyBundle {
  project: SketchyProject;
  files: Map<string, Blob>;
  missing: string[];
}

function assetPath(id: string): string {
  return `assets/${id}`;
}

/** ZIP with manifest.json and the original blobs. Previews are not required. */
export async function packSketchy(project: SketchyProject, blobs: ReadonlyMap<string, Blob>): Promise<Blob> {
  const zip = new JSZip();
  zip.file("manifest.json", serializeProject(project));
  zip.file("settings/export.json", JSON.stringify({ exportedAt: project.updatedAt }));
  for (const id of collectAssetIds(project)) {
    const blob = blobs.get(id);
    if (blob) zip.file(assetPath(id), blob);
  }
  return zip.generateAsync({ type: "blob" });
}

export async function unpackSketchy(data: ArrayBuffer): Promise<SketchyBundle> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error("That file is not a .sketchy archive");
  }
  const manifest = zip.file("manifest.json");
  if (!manifest) throw new Error("Sketchy file is missing manifest.json");
  const project = parseProject(await manifest.async("string"));
  const files = new Map<string, Blob>();
  const reads: Promise<void>[] = [];
  zip.forEach((path, entry) => {
    if (entry.dir || !path.startsWith("assets/")) return;
    const id = path.slice("assets/".length);
    if (!id || id.includes("/")) return;
    reads.push(
      entry.async("blob").then((blob) => {
        files.set(id, blob);
      }),
    );
  });
  await Promise.all(reads);
  return { project, files, missing: missingAssetIds(project, new Set(files.keys())) };
}

export function sketchyFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `${cleaned || "sketchy"}.sketchy`;
}
