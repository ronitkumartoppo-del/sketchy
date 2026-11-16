import type { SketchyProject } from "./types.ts";

/** Asset ids named by these projects. Undo snapshots count, so a deleted image can come back. */
export function referencedAssetIds(projects: readonly SketchyProject[]): Set<string> {
  const ids = new Set<string>();
  for (const project of projects) {
    for (const id of Object.keys(project.assets)) ids.add(id);
  }
  return ids;
}

/** Blob ids that no open snapshot still names. Those bytes are safe to delete. */
export function unreachableBlobIds(storedIds: readonly string[], projects: readonly SketchyProject[]): string[] {
  const keep = referencedAssetIds(projects);
  return storedIds.filter((id) => !keep.has(id));
}
