import { activeBoard, emptyBoard, emptyImageProject } from "./document.ts";
import type {
  AssetRecord,
  Adjustments,
  BoardObject,
  Camera,
  DrawingObject,
  IdFactory,
  ImageEditProject,
  ImageMask,
  SketchyProject,
} from "./types";

function touch(project: SketchyProject, patch: Partial<SketchyProject>): SketchyProject {
  return { ...project, ...patch, updatedAt: new Date().toISOString() };
}

function mapActiveObjects(
  project: SketchyProject,
  mapper: (objects: BoardObject[]) => BoardObject[],
): SketchyProject {
  return touch(project, {
    boards: project.boards.map((board) =>
      board.id === project.activeBoardId ? { ...board, objects: mapper(board.objects) } : board,
    ),
  });
}

export function addObject(project: SketchyProject, object: BoardObject): SketchyProject {
  return mapActiveObjects(project, (objects) => [...objects, object]);
}

export function updateObject(project: SketchyProject, id: string, next: BoardObject): SketchyProject {
  return touch(project, {
    boards: project.boards.map((board) => ({
      ...board,
      objects: board.objects.map((object) => (object.id === id ? next : object)),
    })),
  });
}

export function patchObject(
  project: SketchyProject,
  id: string,
  patch: Partial<BoardObject>,
): SketchyProject {
  return touch(project, {
    boards: project.boards.map((board) => ({
      ...board,
      objects: board.objects.map((object) =>
        object.id === id ? ({ ...object, ...patch } as BoardObject) : object,
      ),
    })),
  });
}

export function setCamera(project: SketchyProject, camera: Camera): SketchyProject {
  return {
    ...project,
    boards: project.boards.map((board) =>
      board.id === project.activeBoardId ? { ...board, camera } : board,
    ),
  };
}

export function setActiveBoard(project: SketchyProject, boardId: string): SketchyProject {
  if (!project.boards.some((board) => board.id === boardId)) return project;
  return { ...project, activeBoardId: boardId };
}

export function addBoard(project: SketchyProject, createId: IdFactory): SketchyProject {
  const board = emptyBoard(createId("board"), `Board ${project.boards.length + 1}`);
  return touch(project, {
    boards: [...project.boards, board],
    activeBoardId: board.id,
  });
}

export function recolorObjects(
  project: SketchyProject,
  ids: readonly string[],
  patch: { stroke?: string; fill?: string },
): SketchyProject {
  const selected = new Set(ids);
  return touch(project, {
    boards: project.boards.map((board) => ({
      ...board,
      objects: board.objects.map((object) => {
        if (!selected.has(object.id) || object.type === "image") return object;
        if (object.type === "pen" || object.type === "arrow") {
          return patch.stroke ? { ...object, stroke: patch.stroke } : object;
        }
        if (object.type === "text") {
          return patch.fill ? { ...object, fill: patch.fill } : object;
        }
        return {
          ...object,
          ...(patch.stroke ? { stroke: patch.stroke } : {}),
          ...(patch.fill ? { fill: patch.fill } : {}),
        };
      }),
    })),
  });
}

export function setLocked(project: SketchyProject, ids: readonly string[], locked: boolean): SketchyProject {
  const selected = new Set(ids);
  return touch(project, {
    boards: project.boards.map((board) => ({
      ...board,
      objects: board.objects.map((object) =>
        selected.has(object.id) ? { ...object, locked } : object,
      ),
    })),
  });
}

export function removeObjects(project: SketchyProject, ids: readonly string[]): SketchyProject {
  const selected = new Set(ids);
  const next = touch(project, {
    boards: project.boards.map((board) => ({
      ...board,
      objects: board.objects.filter((object) => !selected.has(object.id)),
    })),
  });
  return dropUnusedImageProjects(next);
}

function dropUnusedImageProjects(project: SketchyProject): SketchyProject {
  const used = new Set<string>();
  for (const board of project.boards) {
    for (const object of board.objects) {
      if (object.type === "image") used.add(object.imageProjectId);
    }
  }
  const imageProjects: Record<string, ImageEditProject> = {};
  for (const [id, edit] of Object.entries(project.imageProjects)) {
    if (used.has(id)) imageProjects[id] = edit;
  }
  return { ...project, imageProjects };
}

export function duplicateObjects(
  project: SketchyProject,
  ids: readonly string[],
  createId: IdFactory,
): { project: SketchyProject; ids: string[] } {
  const selected = new Set(ids);
  const created: string[] = [];
  let imageProjects = { ...project.imageProjects };
  const boards = project.boards.map((board) => {
    if (board.id !== project.activeBoardId) return board;
    const copies: BoardObject[] = [];
    for (const object of board.objects) {
      if (!selected.has(object.id)) continue;
      const id = createId("obj");
      created.push(id);
      if (object.type === "image") {
        const source = project.imageProjects[object.imageProjectId];
        const imageProjectId = createId("edit");
        imageProjects = {
          ...imageProjects,
          [imageProjectId]: source
            ? {
                ...structuredClone(source),
                id: imageProjectId,
                drawings: source.drawings.map((drawing) => ({ ...drawing, id: createId("draw") })),
              }
            : emptyImageProject(imageProjectId, object.assetId),
        };
        copies.push({ ...object, id, x: object.x + 28, y: object.y + 28, imageProjectId, locked: false });
      } else {
        copies.push({ ...structuredClone(object), id, x: object.x + 28, y: object.y + 28, locked: false });
      }
    }
    return { ...board, objects: [...board.objects, ...copies] };
  });
  return {
    project: touch(project, { boards, imageProjects }),
    ids: created,
  };
}

export function reorderObjects(
  project: SketchyProject,
  ids: readonly string[],
  direction: "forward" | "backward" | "front" | "back",
): SketchyProject {
  const selected = new Set(ids);
  return mapActiveObjects(project, (objects) => {
    if (direction === "front") {
      return [...objects.filter((object) => !selected.has(object.id)), ...objects.filter((object) => selected.has(object.id))];
    }
    if (direction === "back") {
      return [...objects.filter((object) => selected.has(object.id)), ...objects.filter((object) => !selected.has(object.id))];
    }
    const next = objects.slice();
    const indexes = next
      .map((object, index) => (selected.has(object.id) ? index : -1))
      .filter((index) => index >= 0);
    const ordered = direction === "forward" ? indexes.reverse() : indexes;
    for (const index of ordered) {
      const swap = direction === "forward" ? index + 1 : index - 1;
      if (swap < 0 || swap >= next.length) continue;
      if (selected.has(next[swap]!.id)) continue;
      const current = next[index]!;
      next[index] = next[swap]!;
      next[swap] = current;
    }
    return next;
  });
}

export function insertImage(
  project: SketchyProject,
  input: { asset: AssetRecord; x: number; y: number; width: number; height: number },
  createId: IdFactory,
): SketchyProject {
  const imageProjectId = createId("edit");
  const objectId = createId("obj");
  const imageProjects = {
    ...project.imageProjects,
    [imageProjectId]: emptyImageProject(imageProjectId, input.asset.id),
  };
  const object: BoardObject = {
    id: objectId,
    type: "image",
    x: input.x,
    y: input.y,
    rotation: 0,
    locked: false,
    width: input.width,
    height: input.height,
    assetId: input.asset.id,
    imageProjectId,
  };
  const withObject = mapActiveObjects(
    { ...project, assets: { ...project.assets, [input.asset.id]: input.asset }, imageProjects },
    (objects) => [...objects, object],
  );
  return withObject;
}

export function updateImageProject(
  project: SketchyProject,
  imageProjectId: string,
  recipe: (edit: ImageEditProject) => ImageEditProject,
): SketchyProject {
  const current = project.imageProjects[imageProjectId];
  if (!current) return project;
  return touch(project, {
    imageProjects: { ...project.imageProjects, [imageProjectId]: recipe(current) },
  });
}

export function addDrawing(
  project: SketchyProject,
  imageProjectId: string,
  drawing: DrawingObject,
): SketchyProject {
  return updateImageProject(project, imageProjectId, (edit) => ({
    ...edit,
    drawings: [...edit.drawings, drawing],
  }));
}

export function recolorDrawing(
  project: SketchyProject,
  imageProjectId: string,
  drawingId: string,
  patch: { stroke?: string; fill?: string },
): SketchyProject {
  return updateImageProject(project, imageProjectId, (edit) => ({
    ...edit,
    drawings: edit.drawings.map((drawing) =>
      drawing.id === drawingId
        ? {
            ...drawing,
            ...(patch.stroke ? { stroke: patch.stroke } : {}),
            ...(patch.fill ? { fill: patch.fill } : {}),
          }
        : drawing,
    ),
  }));
}

export function replaceDrawing(
  project: SketchyProject,
  imageProjectId: string,
  drawing: DrawingObject,
): SketchyProject {
  return updateImageProject(project, imageProjectId, (edit) => ({
    ...edit,
    drawings: edit.drawings.map((item) => (item.id === drawing.id ? drawing : item)),
  }));
}

export function removeDrawings(
  project: SketchyProject,
  imageProjectId: string,
  ids: readonly string[],
): SketchyProject {
  const selected = new Set(ids);
  return updateImageProject(project, imageProjectId, (edit) => ({
    ...edit,
    drawings: edit.drawings.filter((drawing) => !selected.has(drawing.id)),
  }));
}

export function recolorDrawings(
  project: SketchyProject,
  imageProjectId: string,
  ids: readonly string[],
  patch: { stroke?: string; fill?: string },
): SketchyProject {
  const selected = new Set(ids);
  return updateImageProject(project, imageProjectId, (edit) => ({
    ...edit,
    drawings: edit.drawings.map((drawing) => {
      if (!selected.has(drawing.id)) return drawing;
      if (drawing.kind === "text") {
        const color = patch.fill ?? patch.stroke;
        return color ? { ...drawing, fill: color, stroke: color } : drawing;
      }
      return {
        ...drawing,
        ...(patch.stroke ? { stroke: patch.stroke } : {}),
        ...(patch.fill ? { fill: patch.fill } : {}),
      };
    }),
  }));
}

export function duplicateDrawings(
  project: SketchyProject,
  imageProjectId: string,
  ids: readonly string[],
  createId: IdFactory,
): { project: SketchyProject; ids: string[] } {
  const created: string[] = [];
  const next = updateImageProject(project, imageProjectId, (edit) => {
    const copies = edit.drawings
      .filter((drawing) => ids.includes(drawing.id))
      .map((drawing) => {
        const id = createId("draw");
        created.push(id);
        const nudge = Math.max(12, (drawing.width ?? drawing.fontSize ?? 24) * 0.15);
        return { ...drawing, id, x: drawing.x + nudge, y: drawing.y + nudge };
      });
    return { ...edit, drawings: [...edit.drawings, ...copies] };
  });
  return { project: next, ids: created };
}

export function setImageMask(
  project: SketchyProject,
  imageProjectId: string,
  mask: ImageMask | null,
): SketchyProject {
  return updateImageProject(project, imageProjectId, (edit) => ({ ...edit, mask }));
}

export function setImageAdjustments(
  project: SketchyProject,
  imageProjectId: string,
  adjustments: Adjustments,
): SketchyProject {
  return updateImageProject(project, imageProjectId, (edit) => ({ ...edit, adjustments }));
}

/** Keep the caller's view still when undo restores an older camera or board. */
export function preserveView(from: SketchyProject, to: SketchyProject): SketchyProject {
  const cameras = new Map(from.boards.map((board) => [board.id, board.camera]));
  const boards = to.boards.map((board) =>
    cameras.has(board.id) ? { ...board, camera: cameras.get(board.id)! } : board,
  );
  const activeBoardId = to.boards.some((board) => board.id === from.activeBoardId)
    ? from.activeBoardId
    : to.activeBoardId;
  return { ...to, boards, activeBoardId };
}

export function objectCount(project: SketchyProject): number {
  return project.boards.reduce((sum, board) => sum + board.objects.length, 0);
}

export { activeBoard };
