import { create } from "zustand";
import { createHistory, historyCommit, historyRedo, historyUndo } from "../model/history";
import { createId } from "../model/ids";
import { createProject } from "../model/document";
import {
  addBoard,
  duplicateObjects,
  preserveView,
  recolorObjects,
  removeObjects,
  reorderObjects,
  setActiveBoard,
  setCamera,
  setLocked,
} from "../model/ops";
import type { BoardObject, Camera, SketchyProject, Tool } from "../model/types";
import { palette } from "../model/palette";

interface SketchyStore {
  history: ReturnType<typeof createHistory<SketchyProject>>;
  assetUrls: Record<string, string>;
  selection: string[];
  tool: Tool;
  stroke: string;
  fill: string;
  colorTarget: "stroke" | "fill";
  ready: boolean;
  markReady: () => void;
  hydrate: (project: SketchyProject, urls: Record<string, string>) => void;
  setTool: (tool: Tool) => void;
  setColorTarget: (target: "stroke" | "fill") => void;
  paint: (color: string) => void;
  selectOnly: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  commit: (recipe: (project: SketchyProject) => SketchyProject) => void;
  patch: (recipe: (project: SketchyProject) => SketchyProject) => void;
  undo: () => void;
  redo: () => void;
  removeSelection: () => void;
  duplicate: () => void;
  toggleLock: () => void;
  reorder: (direction: "forward" | "backward" | "front" | "back") => void;
  switchBoard: (boardId: string) => void;
  newBoard: () => void;
  setBoardCamera: (camera: Camera) => void;
  rememberAssetUrl: (id: string, url: string) => void;
  replaceObject: (object: BoardObject) => void;
}

function pruneSelection(project: SketchyProject, selection: string[]): string[] {
  const ids = new Set(project.boards.flatMap((board) => board.objects.map((object) => object.id)));
  return selection.filter((id) => ids.has(id));
}

export const useSketchy = create<SketchyStore>((set, get) => ({
  history: createHistory(createProject()),
  assetUrls: {},
  selection: [],
  tool: "select",
  stroke: palette.ink,
  fill: "transparent",
  colorTarget: "stroke",
  ready: false,
  markReady: () => set({ ready: true }),
  hydrate: (project, urls) =>
    set({
      history: createHistory(project),
      assetUrls: urls,
      selection: [],
      ready: true,
    }),
  setTool: (tool) =>
    set((state) => ({
      tool,
      selection: tool === "select" || tool === "pan" ? state.selection : [],
    })),
  setColorTarget: (colorTarget) => set({ colorTarget }),
  paint: (color) => {
    const { colorTarget, selection, history } = get();
    if (colorTarget === "stroke") set({ stroke: color });
    else set({ fill: color });
    if (selection.length === 0) return;
    const patch = colorTarget === "stroke" ? { stroke: color } : { fill: color };
    set({ history: historyCommit(history, recolorObjects(history.present, selection, patch)) });
  },
  selectOnly: (id) => set({ selection: id ? [id] : [] }),
  toggleSelect: (id) =>
    set((state) => ({
      selection: state.selection.includes(id)
        ? state.selection.filter((item) => item !== id)
        : [...state.selection, id],
    })),
  commit: (recipe) =>
    set((state) => {
      const present = recipe(state.history.present);
      return {
        history: historyCommit(state.history, present),
        selection: pruneSelection(present, state.selection),
      };
    }),
  patch: (recipe) =>
    set((state) => ({
      history: { ...state.history, present: recipe(state.history.present) },
    })),
  undo: () =>
    set((state) => {
      const undone = historyUndo(state.history);
      if (undone === state.history) return state;
      const present = preserveView(state.history.present, undone.present);
      return {
        history: { ...undone, present },
        selection: pruneSelection(present, state.selection),
      };
    }),
  redo: () =>
    set((state) => {
      const redone = historyRedo(state.history);
      if (redone === state.history) return state;
      const present = preserveView(state.history.present, redone.present);
      return {
        history: { ...redone, present },
        selection: pruneSelection(present, state.selection),
      };
    }),
  removeSelection: () => {
    const { history, selection } = get();
    if (selection.length === 0) return;
    const present = removeObjects(history.present, selection);
    set({ history: historyCommit(history, present), selection: [] });
  },
  duplicate: () => {
    const { history, selection } = get();
    if (selection.length === 0) return;
    const result = duplicateObjects(history.present, selection, createId);
    set({ history: historyCommit(history, result.project), selection: result.ids });
  },
  toggleLock: () => {
    const { history, selection } = get();
    if (selection.length === 0) return;
    const objects = history.present.boards.flatMap((board) => board.objects);
    const chosen = objects.filter((object) => selection.includes(object.id));
    const locked = chosen.every((object) => object.locked);
    set({
      history: historyCommit(history, setLocked(history.present, selection, !locked)),
    });
  },
  reorder: (direction) => {
    const { history, selection } = get();
    if (selection.length === 0) return;
    set({
      history: historyCommit(history, reorderObjects(history.present, selection, direction)),
    });
  },
  switchBoard: (boardId) =>
    set((state) => ({
      history: { ...state.history, present: setActiveBoard(state.history.present, boardId) },
      selection: [],
    })),
  newBoard: () =>
    set((state) => ({
      history: historyCommit(state.history, addBoard(state.history.present, createId)),
      selection: [],
    })),
  setBoardCamera: (camera) =>
    set((state) => ({
      history: { ...state.history, present: setCamera(state.history.present, camera) },
    })),
  rememberAssetUrl: (id, url) => set((state) => ({ assetUrls: { ...state.assetUrls, [id]: url } })),
  replaceObject: (object) => {
    const { history } = get();
    const present = {
      ...history.present,
      updatedAt: new Date().toISOString(),
      boards: history.present.boards.map((board) => ({
        ...board,
        objects: board.objects.map((item) => (item.id === object.id ? object : item)),
      })),
    };
    set({ history: historyCommit(history, present) });
  },
}));
