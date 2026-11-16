import { activeBoard, emptyBoard, emptyImageProject } from "./document.ts";
import {
  bakeBoardTransform,
  boundsOf,
  containsInFrame,
  findParent,
  liftPoint,
  unliftPoint,
  worldCenter,
  type Box,
} from "./geometry.ts";
import type {
  AssetRecord,
  Adjustments,
  BoardObject,
  Camera,
  ConnectorObject,
  DrawingObject,
  FrameObject,
  GroupObject,
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
  const added = mapActiveObjects(project, (objects) => [...objects, object]);
  return rehome(added, object.id);
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
        if (!selected.has(object.id) || object.type === "image" || object.type === "group") return object;
        if (object.type === "pen" || object.type === "arrow" || object.type === "curve" || object.type === "connector") {
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
  const next = touch(project, {
    boards: project.boards.map((board) => {
      const selected = collectRemoval(board.objects, ids);
      return {
        ...board,
        objects: board.objects
          .filter((object) => !selected.has(object.id))
          .map((object) =>
            object.type === "group" || object.type === "frame"
              ? { ...object, childIds: object.childIds.filter((id) => !selected.has(id)) }
              : object,
          ),
      };
    }),
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
  return dropUnusedAssets({ ...project, imageProjects });
}

function dropUnusedAssets(project: SketchyProject): SketchyProject {
  const used = new Set<string>();
  for (const edit of Object.values(project.imageProjects)) used.add(edit.assetId);
  for (const board of project.boards) {
    for (const object of board.objects) {
      if (object.type === "image") used.add(object.assetId);
    }
  }
  let changed = false;
  const assets: SketchyProject["assets"] = {};
  for (const [id, asset] of Object.entries(project.assets)) {
    if (used.has(id)) assets[id] = asset;
    else changed = true;
  }
  return changed ? { ...project, assets } : project;
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
    const idMap = new Map<string, string>();
    const copies: BoardObject[] = [];
    const clone = (object: BoardObject): void => {
      if (idMap.has(object.id)) return;
      const id = createId("obj");
      idMap.set(object.id, id);
      if (object.type === "group" || object.type === "frame") {
        for (const childId of object.childIds) {
          const child = board.objects.find((item) => item.id === childId);
          if (child) clone(child);
        }
        copies.push({
          ...structuredClone(object),
          id,
          childIds: object.childIds.map((childId) => idMap.get(childId)).filter((childId): childId is string => Boolean(childId)),
          x: object.x + 28,
          y: object.y + 28,
          locked: false,
        });
        return;
      }
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
        return;
      }
      if (object.type === "connector") {
        copies.push({
          ...object,
          id,
          locked: false,
          fromId: idMap.get(object.fromId) ?? object.fromId,
          toId: idMap.get(object.toId) ?? object.toId,
        });
        return;
      }
      copies.push({ ...structuredClone(object), id, x: object.x + 28, y: object.y + 28, locked: false });
    };
    for (const object of board.objects) {
      if (selected.has(object.id)) clone(object);
    }
    let objects = [...board.objects, ...copies];
    for (const object of board.objects) {
      if (!selected.has(object.id) || !idMap.has(object.id)) continue;
      const parent = findParent(board.objects, object.id);
      if (!parent || idMap.has(parent.id)) continue;
      const copyId = idMap.get(object.id)!;
      objects = objects.map((item) =>
        item.id === parent.id && (item.type === "group" || item.type === "frame")
          ? { ...item, childIds: [...item.childIds, copyId] }
          : item,
      );
    }
    for (const id of ids) {
      const copyId = idMap.get(id);
      if (copyId) created.push(copyId);
    }
    return { ...board, objects };
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
  return rehome(withObject, objectId);
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

function setBoardObjects(project: SketchyProject, objects: BoardObject[]): SketchyProject {
  return touch(project, {
    boards: project.boards.map((board) =>
      board.id === project.activeBoardId ? { ...board, objects } : board,
    ),
  });
}

function collectRemoval(objects: readonly BoardObject[], ids: readonly string[]): Set<string> {
  const selected = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const object of objects) {
      if (!selected.has(object.id) || (object.type !== "group" && object.type !== "frame")) continue;
      for (const childId of object.childIds) {
        if (!selected.has(childId)) {
          selected.add(childId);
          grew = true;
        }
      }
    }
  }
  for (const object of objects) {
    if (object.type === "connector" && (selected.has(object.fromId) || selected.has(object.toId))) {
      selected.add(object.id);
    }
  }
  return selected;
}

function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function containsDeep(objects: readonly BoardObject[], ancestorId: string, id: string): boolean {
  const ancestor = objects.find((object) => object.id === ancestorId);
  if (!ancestor || (ancestor.type !== "group" && ancestor.type !== "frame")) return false;
  if (ancestor.childIds.includes(id)) return true;
  return ancestor.childIds.some((childId) => containsDeep(objects, childId, id));
}

function sameParent(objects: readonly BoardObject[], ids: readonly string[]): string | null | undefined {
  if (ids.length < 2) return undefined;
  const parents = new Set(ids.map((id) => findParent(objects, id)?.id ?? ""));
  if (parents.size !== 1) return undefined;
  return [...parents][0] ?? "";
}

/** Members that can share one group. Null when the selection is mixed or too small. */
export function groupMembers(objects: readonly BoardObject[], ids: readonly string[]): string[] | null {
  const candidates = ids.filter((id) => {
    const object = objects.find((item) => item.id === id);
    return Boolean(object && object.type !== "connector");
  });
  const kept = candidates.filter(
    (id) => !candidates.some((other) => other !== id && containsDeep(objects, other, id)),
  );
  if (kept.length < 2) return null;
  if (sameParent(objects, kept) === undefined) return null;
  return kept;
}

export function groupObjects(
  project: SketchyProject,
  ids: readonly string[],
  createId: IdFactory,
): { project: SketchyProject; id: string | null } {
  const objects = activeBoard(project).objects;
  const members = groupMembers(objects, ids);
  if (!members) return { project, id: null };
  const nodes = members.map((id) => objects.find((object) => object.id === id)!);
  const box = unionBox(nodes.map((object) => boundsOf(object)));
  if (!box) return { project, id: null };
  const groupId = createId("obj");
  const parentId = findParent(objects, members[0]!)?.id ?? "";
  const group: GroupObject = {
    id: groupId,
    type: "group",
    x: box.x,
    y: box.y,
    rotation: 0,
    locked: false,
    width: Math.max(8, box.w),
    height: Math.max(8, box.h),
    childIds: members,
  };
  const memberSet = new Set(members);
  let next = objects.map((object) =>
    memberSet.has(object.id) ? { ...object, x: object.x - box.x, y: object.y - box.y } : object,
  );
  if (parentId) {
    next = next.map((object) =>
      object.id === parentId && (object.type === "group" || object.type === "frame")
        ? { ...object, childIds: [...object.childIds.filter((id) => !memberSet.has(id)), groupId] }
        : object,
    );
  }
  next = [...next, group];
  return { project: setBoardObjects(project, refitGroups(next)), id: groupId };
}

export function ungroupObjects(
  project: SketchyProject,
  ids: readonly string[],
): { project: SketchyProject; ids: string[] } {
  let objects = activeBoard(project).objects.slice();
  const released: string[] = [];
  for (const id of ids) {
    const container = objects.find((object) => object.id === id);
    if (!container || (container.type !== "group" && container.type !== "frame")) continue;
    const parent = findParent(objects, container.id);
    const lifted = new Set(container.childIds);
    objects = objects.map((object) => {
      if (!lifted.has(object.id)) return object;
      const origin = liftPoint(container, { x: object.x, y: object.y });
      return { ...object, x: origin.x, y: origin.y, rotation: object.rotation + container.rotation };
    });
    if (parent) {
      objects = objects.map((object) =>
        object.id === parent.id && (object.type === "group" || object.type === "frame")
          ? {
              ...object,
              childIds: [...object.childIds.filter((childId) => childId !== container.id), ...container.childIds],
            }
          : object,
      );
    }
    objects = objects.filter((object) => object.id !== container.id);
    released.push(...container.childIds);
  }
  return { project: setBoardObjects(project, refitGroups(objects)), ids: released };
}

export function addConnector(
  project: SketchyProject,
  fromId: string,
  toId: string,
  stroke: string,
  createId: IdFactory,
): { project: SketchyProject; id: string | null } {
  if (fromId === toId) return { project, id: null };
  const objects = activeBoard(project).objects;
  const from = objects.find((object) => object.id === fromId);
  const to = objects.find((object) => object.id === toId);
  if (!from || !to || from.type === "connector" || to.type === "connector") return { project, id: null };
  const existing = objects.find(
    (object) =>
      object.type === "connector" &&
      ((object.fromId === fromId && object.toId === toId) || (object.fromId === toId && object.toId === fromId)),
  );
  if (existing) return { project, id: existing.id };
  const id = createId("obj");
  const connector: ConnectorObject = {
    id,
    type: "connector",
    x: 0,
    y: 0,
    rotation: 0,
    locked: false,
    fromId,
    toId,
    stroke,
    strokeWidth: 2.5,
  };
  return { project: setBoardObjects(project, [...objects, connector]), id };
}

export function moveObject(project: SketchyProject, id: string, x: number, y: number): SketchyProject {
  const objects = activeBoard(project).objects;
  if (!objects.some((object) => object.id === id)) return project;
  const moved = objects.map((object) => (object.id === id ? ({ ...object, x, y } as BoardObject) : object));
  return setBoardObjects(project, refitGroups(settleMembership(moved, id)));
}

export function transformOwned(
  project: SketchyProject,
  id: string,
  t: { x: number; y: number; rotation: number; scaleX: number; scaleY: number },
): SketchyProject {
  const objects = activeBoard(project).objects;
  const object = objects.find((item) => item.id === id);
  if (!object) return project;
  if (object.type !== "group" && object.type !== "frame") {
    return updateObject(project, id, bakeBoardTransform(object, t));
  }
  const sx = t.scaleX;
  const sy = t.scaleY;
  const queue = [...object.childIds];
  const seen = new Set<string>();
  let next = objects.slice();
  while (queue.length > 0) {
    const childId = queue.shift()!;
    if (seen.has(childId)) continue;
    seen.add(childId);
    const child = next.find((item) => item.id === childId);
    if (!child) continue;
    if (child.type === "group" || child.type === "frame") queue.push(...child.childIds);
    const baked = bakeBoardTransform(child, {
      x: child.x * sx,
      y: child.y * sy,
      rotation: child.rotation,
      scaleX: sx,
      scaleY: sy,
    });
    next = next.map((item) => (item.id === childId ? baked : item));
  }
  const container = bakeBoardTransform(object, t);
  next = next.map((item) => (item.id === id ? container : item));
  return setBoardObjects(project, refitGroups(next));
}

function localOriginToWorld(objects: readonly BoardObject[], id: string): { x: number; y: number } {
  const object = objects.find((item) => item.id === id);
  if (!object) return { x: 0, y: 0 };
  let point = { x: object.x, y: object.y };
  let parent = findParent(objects, id);
  while (parent) {
    point = liftPoint(parent, point);
    parent = findParent(objects, parent.id);
  }
  return point;
}

function topFrameAt(objects: readonly BoardObject[], point: { x: number; y: number }, ignoreId: string): FrameObject | null {
  let host: FrameObject | null = null;
  for (const object of objects) {
    if (object.type !== "frame" || object.id === ignoreId) continue;
    if (findParent(objects, object.id)) continue;
    if (!containsInFrame(object, point)) continue;
    host = object;
  }
  return host;
}

function detach(objects: BoardObject[], id: string, world: { x: number; y: number }): BoardObject[] {
  const parent = findParent(objects, id);
  const object = objects.find((item) => item.id === id);
  return objects
    .map((item) => {
      if (item.id === id && object) {
        return { ...object, x: world.x, y: world.y, rotation: object.rotation + (parent?.rotation ?? 0) } as BoardObject;
      }
      if (parent && item.id === parent.id && (item.type === "group" || item.type === "frame")) {
        return { ...item, childIds: item.childIds.filter((childId) => childId !== id) };
      }
      return item;
    });
}

function attach(objects: BoardObject[], id: string, frameId: string): BoardObject[] {
  const object = objects.find((item) => item.id === id);
  const frame = objects.find((item) => item.id === frameId);
  if (!object || !frame || frame.type !== "frame") return objects;
  const local = unliftPoint(frame, { x: object.x, y: object.y });
  return objects.map((item) => {
    if (item.id === id) return { ...object, x: local.x, y: local.y } as BoardObject;
    if (item.id === frameId && item.type === "frame") return { ...item, childIds: [...item.childIds, id] };
    return item;
  });
}

function settleMembership(objects: BoardObject[], id: string): BoardObject[] {
  const object = objects.find((item) => item.id === id);
  if (!object || object.type === "frame" || object.type === "connector") return objects;
  const parent = findParent(objects, id);
  if (parent?.type === "frame") {
    const box = boundsOf(object);
    const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const inside = center.x >= 0 && center.y >= 0 && center.x <= parent.width && center.y <= parent.height;
    if (inside) return objects;
    const origin = localOriginToWorld(objects, id);
    let next = detach(objects, id, origin);
    const centerWorld = worldCenter(next, id);
    const host = centerWorld ? topFrameAt(next, centerWorld, id) : null;
    if (host && host.id !== parent.id) next = attach(next, id, host.id);
    return next;
  }
  if (parent) return objects;
  const center = worldCenter(objects, id);
  if (!center) return objects;
  const host = topFrameAt(objects, center, id);
  if (!host) return objects;
  return attach(objects, id, host.id);
}

function rehome(project: SketchyProject, id: string): SketchyProject {
  const objects = activeBoard(project).objects;
  if (!objects.some((object) => object.id === id)) return project;
  return setBoardObjects(project, refitGroups(settleMembership(objects, id)));
}

function depthOf(objects: readonly BoardObject[], id: string): number {
  let depth = 0;
  let parent = findParent(objects, id);
  while (parent) {
    depth += 1;
    parent = findParent(objects, parent.id);
  }
  return depth;
}

function refitGroups(objects: BoardObject[]): BoardObject[] {
  const groups = objects
    .filter((object): object is GroupObject => object.type === "group")
    .slice()
    .sort((a, b) => depthOf(objects, b.id) - depthOf(objects, a.id));
  let next = objects;
  for (const group of groups) {
    const current = next.find((object) => object.id === group.id);
    if (!current || current.type !== "group" || current.childIds.length === 0) continue;
    const children = current.childIds
      .map((childId) => next.find((object) => object.id === childId))
      .filter((object): object is BoardObject => Boolean(object));
    const box = unionBox(children.map((child) => boundsOf(child)));
    if (!box) continue;
    if (
      Math.abs(box.x) < 0.01 &&
      Math.abs(box.y) < 0.01 &&
      Math.abs(box.w - current.width) < 0.01 &&
      Math.abs(box.h - current.height) < 0.01
    ) {
      continue;
    }
    const shift = liftPoint({ x: 0, y: 0, rotation: current.rotation }, { x: box.x, y: box.y });
    const childSet = new Set(current.childIds);
    next = next.map((object) => {
      if (object.id === current.id && object.type === "group") {
        return {
          ...object,
          x: object.x + shift.x,
          y: object.y + shift.y,
          width: Math.max(8, box.w),
          height: Math.max(8, box.h),
        };
      }
      if (childSet.has(object.id)) return { ...object, x: object.x - box.x, y: object.y - box.y };
      return object;
    });
  }
  return next;
}

export { activeBoard };
