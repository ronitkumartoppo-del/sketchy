import { createId } from "./ids.ts";
import type {
  Adjustments,
  Board,
  BoardObject,
  Camera,
  IdFactory,
  ImageEditProject,
  SketchyProject,
} from "./types.ts";
import { SKETCHY_FORMAT, SKETCHY_VERSION } from "./types.ts";

export function defaultAdjustments(): Adjustments {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    grayscale: false,
    blur: 0,
    pixelate: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
  };
}

export function defaultCamera(): Camera {
  return { x: 48, y: 48, scale: 1 };
}

export function emptyBoard(id: string, name: string): Board {
  return { id, name, camera: defaultCamera(), objects: [] };
}

export function createProject(options?: {
  name?: string;
  now?: string;
  createId?: IdFactory;
}): SketchyProject {
  const ids = options?.createId ?? createId;
  const now = options?.now ?? new Date().toISOString();
  const boardId = ids("board");
  return {
    format: SKETCHY_FORMAT,
    version: SKETCHY_VERSION,
    id: ids("project"),
    name: options?.name ?? "Untitled",
    createdAt: now,
    updatedAt: now,
    activeBoardId: boardId,
    boards: [emptyBoard(boardId, "Board 1")],
    assets: {},
    imageProjects: {},
  };
}

export function activeBoard(project: SketchyProject): Board {
  return project.boards.find((board) => board.id === project.activeBoardId) ?? project.boards[0]!;
}

export function findObject(project: SketchyProject, id: string): BoardObject | undefined {
  for (const board of project.boards) {
    const found = board.objects.find((object) => object.id === id);
    if (found) return found;
  }
  return undefined;
}

export function collectAssetIds(project: SketchyProject): string[] {
  const ids = new Set<string>(Object.keys(project.assets));
  for (const board of project.boards) {
    for (const object of board.objects) {
      if (object.type === "image") ids.add(object.assetId);
    }
  }
  for (const edit of Object.values(project.imageProjects)) ids.add(edit.assetId);
  return [...ids];
}

/** Assets referenced by the document but missing from `available` blob ids or the asset table. */
export function missingAssetIds(project: SketchyProject, available: ReadonlySet<string>): string[] {
  const needed = new Set<string>();
  for (const board of project.boards) {
    for (const object of board.objects) {
      if (object.type === "image") needed.add(object.assetId);
    }
  }
  for (const edit of Object.values(project.imageProjects)) needed.add(edit.assetId);
  return [...needed].filter((id) => !available.has(id) || !project.assets[id]).sort();
}

export function serializeProject(project: SketchyProject): string {
  return JSON.stringify(project);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const OBJECT_TYPES = new Set([
  "rect",
  "ellipse",
  "arrow",
  "pen",
  "curve",
  "text",
  "note",
  "image",
  "group",
  "frame",
  "connector",
]);

export function parseProject(raw: string): SketchyProject {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Sketchy file is not valid JSON");
  }
  if (!isRecord(data)) throw new Error("Sketchy project must be an object");
  if (data.format !== SKETCHY_FORMAT) throw new Error("Not a Sketchy project");
  if (data.version !== SKETCHY_VERSION) {
    throw new Error(`Unsupported Sketchy version: ${String(data.version)}`);
  }
  if (typeof data.id !== "string" || typeof data.name !== "string") {
    throw new Error("Sketchy project is missing an id or name");
  }
  if (!Array.isArray(data.boards) || data.boards.length === 0) {
    throw new Error("Sketchy project has no boards");
  }
  for (const board of data.boards) {
    if (!isRecord(board) || typeof board.id !== "string" || !Array.isArray(board.objects)) {
      throw new Error("Sketchy board is invalid");
    }
    for (const object of board.objects) {
      if (!isRecord(object) || typeof object.type !== "string" || !OBJECT_TYPES.has(object.type)) {
        throw new Error("Sketchy board contains an unknown object");
      }
      if (object.type === "image" && (typeof object.assetId !== "string" || typeof object.imageProjectId !== "string")) {
        throw new Error("Sketchy image object is missing its asset or edit project");
      }
      if (
        (object.type === "group" || object.type === "frame") &&
        (!Array.isArray(object.childIds) || object.childIds.some((id) => typeof id !== "string"))
      ) {
        throw new Error("Sketchy group is missing its members");
      }
      if (object.type === "curve" && (!Array.isArray(object.points) || object.points.length < 8)) {
        throw new Error("Sketchy curve is missing its anchors");
      }
      if (object.type === "connector" && (typeof object.fromId !== "string" || typeof object.toId !== "string")) {
        throw new Error("Sketchy connector is missing an end");
      }
    }
  }
  if (!isRecord(data.assets) || !isRecord(data.imageProjects)) {
    throw new Error("Sketchy project is missing assets or image projects");
  }
  for (const edit of Object.values(data.imageProjects)) {
    if (!isRecord(edit) || !Array.isArray(edit.drawings) || typeof edit.assetId !== "string") {
      throw new Error("Sketchy image edit project is invalid");
    }
  }
  return data as unknown as SketchyProject;
}

export function emptyImageProject(id: string, assetId: string): ImageEditProject {
  return {
    id,
    assetId,
    adjustments: defaultAdjustments(),
    mask: null,
    drawings: [],
  };
}
