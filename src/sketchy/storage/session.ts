import { toast } from "sonner";
import { unreachableBlobIds } from "../model/assets";
import { collectAssetIds, parseProject } from "../model/document";
import type { SketchyProject } from "../model/types";
import { useSketchy } from "../store/use-sketchy";
import { fillDisplayUrls } from "../canvas/display-bitmap";
import { idbDeleteBlobs, idbGet, idbGetBlob, idbListBlobIds, idbSet } from "./idb";

const SESSION_KEY = "session";
let started = false;
let timer = 0;
let sweepTimer = 0;

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
    void fillDisplayUrls(project);
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
  scheduleBlobSweep();
}

export function flushPersist(project: SketchyProject): void {
  if (typeof indexedDB === "undefined") return;
  window.clearTimeout(timer);
  void idbSet(SESSION_KEY, project).catch((error) => console.error(error));
  scheduleBlobSweep();
}

function scheduleBlobSweep(): void {
  window.clearTimeout(sweepTimer);
  sweepTimer = window.setTimeout(() => {
    void sweepBlobs();
  }, 400);
}

async function sweepBlobs(): Promise<void> {
  const history = useSketchy.getState().history;
  const stored = await idbListBlobIds();
  const drop = unreachableBlobIds(stored, [history.present, ...history.past, ...history.future]);
  if (drop.length === 0) return;
  await idbDeleteBlobs(drop);
  const urls = { ...useSketchy.getState().assetUrls };
  const displays = { ...useSketchy.getState().displayUrls };
  let changed = false;
  for (const id of drop) {
    const url = urls[id];
    if (url) {
      URL.revokeObjectURL(url);
      delete urls[id];
      changed = true;
    }
    const display = displays[id];
    if (display) {
      URL.revokeObjectURL(display);
      delete displays[id];
      changed = true;
    }
  }
  if (changed) useSketchy.setState({ assetUrls: urls, displayUrls: displays });
}
