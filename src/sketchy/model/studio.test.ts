import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bakeDrawingTransform } from "./geometry.ts";
import { createProject } from "./document.ts";
import {
  addDrawing,
  duplicateDrawings,
  insertImage,
  recolorDrawings,
  removeDrawings,
  replaceDrawing,
} from "./ops.ts";
import type { DrawingObject, IdFactory } from "./types.ts";

function ids(): IdFactory {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

function mark(id: string, stroke: string): DrawingObject {
  return {
    id,
    kind: "rect",
    x: 8,
    y: 8,
    rotation: 0,
    width: 40,
    height: 20,
    stroke,
    fill: "transparent",
    strokeWidth: 4,
    opacity: 1,
  };
}

describe("image studio drawings", () => {
  it("edits one drawing and leaves the original asset and the other mark alone", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    project = insertImage(
      project,
      {
        asset: { id: "asset_shot", mime: "image/png", width: 800, height: 600, byteLength: 90 },
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      },
      createId,
    );
    const image = project.boards[0]!.objects.find((object) => object.type === "image");
    assert.ok(image && image.type === "image");
    if (!image || image.type !== "image") return;
    project = addDrawing(project, image.imageProjectId, mark("a", "#111111"));
    project = addDrawing(project, image.imageProjectId, { ...mark("b", "#222222"), kind: "freehand", points: [0, 0, 10, 4] });
    project = recolorDrawings(project, image.imageProjectId, ["a"], { stroke: "#2347d6" });
    project = replaceDrawing(project, image.imageProjectId, { ...mark("a", "#2347d6"), x: 30, width: 80 });
    const edit = project.imageProjects[image.imageProjectId]!;
    assert.equal(edit.drawings[0]?.x, 30);
    assert.equal(edit.drawings[0]?.width, 80);
    assert.equal(edit.drawings[1]?.stroke, "#222222");
    assert.equal(project.assets.asset_shot?.byteLength, 90);
    assert.equal(project.assets.asset_shot?.width, 800);

    const copied = duplicateDrawings(project, image.imageProjectId, ["b"], createId);
    assert.equal(copied.ids.length, 1);
    assert.equal(copied.project.imageProjects[image.imageProjectId]!.drawings.length, 3);
    assert.equal(copied.project.assets.asset_shot?.byteLength, 90);

    const removed = removeDrawings(copied.project, image.imageProjectId, ["a"]);
    const left = removed.imageProjects[image.imageProjectId]!.drawings.map((drawing) => drawing.id);
    assert.deepEqual(left, ["b", copied.ids[0]]);
    assert.equal(removed.assets.asset_shot?.byteLength, 90);
  });

  it("bakes a scale into source pixels", () => {
    const next = bakeDrawingTransform(mark("a", "#111"), {
      x: 4,
      y: 6,
      rotation: 15,
      scaleX: 2,
      scaleY: 3,
    });
    assert.equal(next.width, 80);
    assert.equal(next.height, 60);
    assert.equal(next.rotation, 15);
    const line = bakeDrawingTransform(
      { ...mark("line", "#111"), kind: "freehand", points: [0, 0, 10, 2] },
      { x: 1, y: 2, rotation: 0, scaleX: 2, scaleY: 4 },
    );
    assert.deepEqual(line.points, [0, 0, 20, 8]);
  });
});
