import { toast } from "sonner";
import { collectAssetIds, parseProject } from "../model/document";
import type { SketchyProject } from "../model/types";
import { useSketchy } from "../store/use-sketchy";
import { idbGet, idbGetBlob, idbSet } from "./idb";

const SESSION_KEY = "session";
let started = false;
let timer = 0;

export function bootstrapSession(): void {
  if (started || typeof indexedDB === "undefined") {
    if (typeof indexedDB === "undefined") useSketchy.getState().markReady();
    return;
  }
  started = true;
  void restore();
}

async function restore(): Promise<void> {
  try {
    const saved = await idbGet<SketchyProject>(SESSION_KEY);
    if (!saved) {
      useSketchy.getState().markReady();
      return;
    }
    const project = parseProject(JSON.stringify(saved));
    const urls: Record<string, string> = {};
    for (const id of collectAssetIds(project)) {
      const blob = await idbGetBlob(id);
      if (blob) urls[id] = URL.createObjectURL(blob);
    }
    useSketchy.getState().hydrate(project, urls);
  } catch (error) {
    console.error(error);
    toast.error("Couldn't read the saved session. Sketchy started a new board.");
    useSketchy.getState().markReady();
  }
}

export function schedulePersist(project: SketchyProject): void {
  if (typeof indexedDB === "undefined") return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void idbSet(SESSION_KEY, project).catch((error) => console.error(error));
  }, 300);
}

export function flushPersist(project: SketchyProject): void {
  if (typeof indexedDB === "undefined") return;
  window.clearTimeout(timer);
  void idbSet(SESSION_KEY, project).catch((error) => console.error(error));
}
