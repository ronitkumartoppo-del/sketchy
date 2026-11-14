import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { curvePoints, cubicPoint } from "./curve.ts";
import { displayPixelSize } from "./display.ts";
import { connectorsForFrame } from "./export.ts";
import { pinchFrom, pinchMove } from "./gestures.ts";
import { screenToWorld } from "./geometry.ts";
import { createHistory, historyCommit, historyUndo } from "./history.ts";
import { addDrawing, addObject, duplicateObjects, insertImage, removeObjects, setImageMask } from "./ops.ts";
import { createProject, parseProject, serializeProject } from "./document.ts";
import type { BoardObject } from "./types.ts";

describe("workflow", () => {
  it("keeps a curve, a crop, and the original bytes through duplicate, undo, and a file round trip", () => {
    const createId = (() => {
      let n = 0;
      return (prefix: string) => `${prefix}_${n++}`;
    })();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    const fitted = displayPixelSize(2000, 1000);
    project = insertImage(
      project,
      { asset: { id: "asset_big", mime: "image/png", width: 2000, height: 1000, byteLength: 9000, name: "big.png" }, x: 0, y: 0, width: fitted.width, height: fitted.height },
      createId,
    );
    const image = project.boards[0]!.objects.find((object) => object.type === "image");
    assert.ok(image && image.type === "image");
    if (!image || image.type !== "image") return;
    assert.equal(image.width, 560);
    assert.equal(project.assets.asset_big?.width, 2000);
    assert.equal(project.assets.asset_big?.byteLength, 9000);
    const points = curvePoints({ x: 80, y: 0 });
    project = addDrawing(project, image.imageProjectId, {
      id: "bow",
      kind: "bezier",
      x: 4,
      y: 6,
      rotation: 0,
      points,
      stroke: "#1a1814",
      fill: "transparent",
      strokeWidth: 2,
      opacity: 1,
    });
    project = setImageMask(project, image.imageProjectId, { kind: "rect", x: 0.1, y: 0.1, w: 0.5, h: 0.5, mode: "keep" });
    const copy = duplicateObjects(project, [image.id], createId);
    assert.equal(copy.project.assets.asset_big?.byteLength, 9000);
    const duplicated = copy.project.boards[0]!.objects.find((object) => object.id === copy.ids[0]);
    assert.ok(duplicated && duplicated.type === "image");
    if (!duplicated || duplicated.type !== "image") return;
    assert.notEqual(duplicated.imageProjectId, image.imageProjectId);
    assert.equal(copy.project.imageProjects[duplicated.imageProjectId]?.drawings[0]?.kind, "bezier");
    assert.equal(copy.project.imageProjects[image.imageProjectId]?.mask?.kind, "rect");
    const mid = cubicPoint(points, 0.5);
    assert.ok(Math.abs(mid.y) > 5);
    let history = createHistory(copy.project, 4);
    history = historyCommit(history, removeObjects(copy.project, [image.id, duplicated.id]));
    assert.equal(history.present.assets.asset_big, undefined);
    history = historyUndo(history);
    assert.equal(history.present.assets.asset_big?.byteLength, 9000);
    const again = parseProject(serializeProject(history.present));
    assert.equal(again.imageProjects[image.imageProjectId]?.drawings[0]?.kind, "bezier");
    const frame: BoardObject = {
      id: "frame",
      type: "frame",
      name: "Story",
      x: 0,
      y: 0,
      rotation: 0,
      locked: false,
      width: 100,
      height: 100,
      fill: "#fffdf8",
      childIds: ["box"],
    };
    const box: BoardObject = {
      id: "box",
      type: "rect",
      x: 10,
      y: 10,
      rotation: 0,
      locked: false,
      width: 20,
      height: 10,
      fill: "transparent",
      stroke: "#1a1814",
      strokeWidth: 2,
    };
    const outside: BoardObject = {
      id: "out",
      type: "rect",
      x: 400,
      y: 400,
      rotation: 0,
      locked: false,
      width: 10,
      height: 10,
      fill: "transparent",
      stroke: "#1a1814",
      strokeWidth: 2,
    };
    const link: BoardObject = {
      id: "link",
      type: "connector",
      x: 0,
      y: 0,
      rotation: 0,
      locked: false,
      fromId: "box",
      toId: "out",
      stroke: "#e23d2b",
      strokeWidth: 2,
    };
    assert.equal(connectorsForFrame([frame, box, outside, link], "frame")[0]?.id, "link");
    const pinch = pinchFrom([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ]);
    assert.ok(pinch);
    if (!pinch) return;
    const zoomed = pinchMove({ x: 0, y: 0, scale: 1 }, pinch, [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
    ]);
    assert.ok(zoomed && zoomed.camera.scale === 2);
    if (!zoomed) return;
    const world = screenToWorld(zoomed.camera, { x: 40, y: 0 });
    assert.ok(Math.abs(world.x - 20) < 0.01);
  });
});
