import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createProject, missingAssetIds, parseProject, serializeProject } from "./document.ts";
import {
  addDrawing,
  duplicateObjects,
  insertImage,
  recolorDrawing,
  recolorObjects,
  removeObjects,
  reorderObjects,
  setImageMask,
} from "./ops.ts";
import type { DrawingObject, IdFactory, RectObject } from "./types.ts";

function ids(): IdFactory {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

function rect(id: string, stroke: string): RectObject {
  return {
    id,
    type: "rect",
    x: 0,
    y: 0,
    rotation: 0,
    locked: false,
    width: 40,
    height: 30,
    fill: "transparent",
    stroke,
    strokeWidth: 2,
  };
}

describe("mindspace objects stay independent", () => {
  it("recolors one shape without touching its neighbor or the previous project", () => {
    const createId = ids();
    const project = createProject({ name: "Board", now: "2026-11-14T00:00:00.000Z", createId });
    const withShapes = {
      ...project,
      boards: project.boards.map((board) => ({
        ...board,
        objects: [rect("s1", "#111111"), rect("s2", "#222222")],
      })),
    };
    const next = recolorObjects(withShapes, ["s1"], { stroke: "#2347d6" });
    const first = next.boards[0]!.objects[0];
    const second = next.boards[0]!.objects[1];
    assert.equal(first && first.type === "rect" && first.stroke, "#2347d6");
    assert.equal(second && second.type === "rect" && second.stroke, "#222222");
    assert.equal(withShapes.boards[0]!.objects[0] && (withShapes.boards[0]!.objects[0] as RectObject).stroke, "#111111");
  });

  it("reorders without dropping objects", () => {
    const createId = ids();
    const project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    const seeded = {
      ...project,
      boards: project.boards.map((board) => ({
        ...board,
        objects: [rect("a", "#111"), rect("b", "#111"), rect("c", "#111")],
      })),
    };
    const front = reorderObjects(seeded, ["a"], "front");
    assert.deepEqual(
      front.boards[0]!.objects.map((object) => object.id),
      ["b", "c", "a"],
    );
  });
});

describe("image edit projects are non-destructive", () => {
  it("keeps the original asset, isolates drawings, and survives a round trip", () => {
    const createId = ids();
    let project = createProject({ name: "Workflow", now: "2026-11-14T00:00:00.000Z", createId });
    project = insertImage(
      project,
      {
        asset: { id: "asset_shot", mime: "image/png", width: 1200, height: 800, byteLength: 40, name: "shot.png" },
        x: 12,
        y: 16,
        width: 480,
        height: 320,
      },
      createId,
    );
    const image = project.boards[0]!.objects.find((object) => object.type === "image");
    assert.ok(image && image.type === "image");
    if (!image || image.type !== "image") return;
    assert.equal(image.assetId, "asset_shot");
    assert.equal(project.assets.asset_shot?.byteLength, 40);

    const mark: DrawingObject = {
      id: "draw_a",
      kind: "rect",
      x: 10,
      y: 10,
      rotation: 0,
      width: 40,
      height: 20,
      stroke: "#111111",
      fill: "transparent",
      strokeWidth: 2,
      opacity: 1,
    };
    const label: DrawingObject = { ...mark, id: "draw_b", kind: "text", text: "Hi", fill: "#111111" };
    project = addDrawing(project, image.imageProjectId, mark);
    project = addDrawing(project, image.imageProjectId, label);
    project = recolorDrawing(project, image.imageProjectId, "draw_a", { stroke: "#e23d2b" });
    project = setImageMask(project, image.imageProjectId, {
      kind: "polygon",
      points: [0.1, 0.1, 0.9, 0.1, 0.8, 0.9],
      mode: "keep",
    });

    const edit = project.imageProjects[image.imageProjectId]!;
    assert.equal(edit.assetId, "asset_shot");
    assert.equal(edit.drawings[0]?.stroke, "#e23d2b");
    assert.equal(edit.drawings[1]?.stroke, "#111111");
    assert.equal(edit.mask?.kind, "polygon");
    assert.equal(project.assets.asset_shot?.width, 1200);

    const copy = duplicateObjects(project, [image.id], createId);
    const duplicated = copy.project.boards[0]!.objects.find((object) => object.id === copy.ids[0]);
    assert.ok(duplicated && duplicated.type === "image");
    if (!duplicated || duplicated.type !== "image") return;
    assert.equal(duplicated.assetId, "asset_shot");
    assert.notEqual(duplicated.imageProjectId, image.imageProjectId);
    const recolored = recolorDrawing(copy.project, image.imageProjectId, copy.project.imageProjects[image.imageProjectId]!.drawings[0]!.id, {
      stroke: "#2347d6",
    });
    assert.equal(recolored.imageProjects[image.imageProjectId]!.drawings[0]?.stroke, "#2347d6");
    assert.notEqual(recolored.imageProjects[duplicated.imageProjectId]!.drawings[0]?.stroke, "#2347d6");

    const restored = parseProject(serializeProject(recolored));
    assert.equal(restored.assets.asset_shot?.name, "shot.png");
    assert.equal(restored.imageProjects[image.imageProjectId]?.mask?.kind, "polygon");
    assert.equal(restored.imageProjects[image.imageProjectId]?.drawings.length, 2);
    assert.deepEqual(missingAssetIds(restored, new Set(["asset_shot"])), []);
    assert.deepEqual(missingAssetIds(restored, new Set()), ["asset_shot"]);

    const removed = removeObjects(restored, [image.id, duplicated.id]);
    assert.equal(removed.boards[0]!.objects.length, 0);
    assert.equal(removed.assets.asset_shot?.id, "asset_shot");
    assert.deepEqual(removed.imageProjects, {});
  });
});

describe("project validation", () => {
  it("rejects a flattened file that is not a Sketchy project", () => {
    assert.throws(() => parseProject("{}"), /Not a Sketchy project/);
    assert.throws(() => parseProject("{"), /not valid JSON/);
  });
});
