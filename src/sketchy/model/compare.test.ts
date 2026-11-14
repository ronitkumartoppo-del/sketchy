import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPARISON_FILENAME,
  clampFade,
  compareReadsOnly,
  compareStage,
  contain,
  defaultComparePair,
  listCompareSources,
  overlayByte,
  slotSkipsAdjustments,
} from "./compare.ts";
import { createProject, defaultAdjustments } from "./document.ts";
import { addDrawing, insertImage } from "./ops.ts";
import type { DrawingObject, IdFactory } from "./types.ts";

function ids(): IdFactory {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

function image(
  project: ReturnType<typeof createProject>,
  createId: IdFactory,
  assetId: string,
  name: string,
  bytes: number,
) {
  return insertImage(
    project,
    {
      asset: { id: assetId, mime: "image/png", width: 400, height: 200, byteLength: bytes, name },
      x: 10,
      y: 12,
      width: 200,
      height: 100,
    },
    createId,
  );
}

function mark(): DrawingObject {
  return {
    id: "draw_1",
    kind: "rect",
    x: 4,
    y: 4,
    rotation: 0,
    width: 20,
    height: 10,
    stroke: "#1a1814",
    fill: "transparent",
    strokeWidth: 3,
    opacity: 1,
  };
}

describe("compare", () => {
  it("lists images and does not rewrite the project or the original bytes", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    project = image(project, createId, "asset_a", "left.png", 111);
    project = image(project, createId, "asset_b", "right.png", 222);
    const first = project.boards[0]!.objects.find((object) => object.type === "image");
    assert.ok(first && first.type === "image");
    if (!first || first.type !== "image") return;
    project = addDrawing(project, first.imageProjectId, mark());
    const sources = listCompareSources(project);
    assert.equal(sources.length, 2);
    assert.equal(sources[0]?.label, "left.png");
    assert.equal(sources[0]?.drawingCount, 1);
    assert.equal(sources[1]?.label, "right.png");
    assert.equal(sources[1]?.hasMask, false);
    assert.equal(project.assets.asset_a?.byteLength, 111);
    assert.equal(project.assets.asset_b?.byteLength, 222);
    assert.equal(compareReadsOnly(project), true);
  });

  it("defaults one image to original versus current, and two images to both current", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    assert.equal(defaultComparePair(listCompareSources(project)), null);
    project = image(project, createId, "asset_a", "only.png", 10);
    const one = defaultComparePair(listCompareSources(project));
    assert.ok(one);
    assert.equal(one?.a.objectId, one?.b.objectId);
    assert.equal(one?.a.view, "original");
    assert.equal(one?.b.view, "edited");
    project = image(project, createId, "asset_b", "only.png", 11);
    const two = defaultComparePair(listCompareSources(project));
    const sources = listCompareSources(project);
    assert.equal(sources[1]?.label, "only.png 2");
    assert.notEqual(two?.a.objectId, two?.b.objectId);
    assert.equal(two?.a.view, "edited");
    assert.equal(two?.b.view, "edited");
  });

  it("fits side by side into two columns and stacks an overlay in one frame", () => {
    const fitted = contain(400, 200, { x: 0, y: 0, w: 200, h: 200 });
    assert.equal(fitted.w, 200);
    assert.equal(fitted.h, 100);
    assert.equal(fitted.y, 50);
    const side = compareStage(400, 200, 200, 200, "side", 416, 200, 16);
    assert.ok(side.a.x + side.a.w <= 200);
    assert.ok(side.b.x >= 216);
    assert.ok(side.b.x + side.b.w <= 416);
    const over = compareStage(400, 200, 400, 200, "overlay", 400, 200, 16);
    assert.deepEqual(over.a, over.b);
    assert.ok(over.a.w <= 400 && over.a.h <= 200);
  });

  it("fades an overlay from A to B and names the download as a picture", () => {
    assert.equal(overlayByte(0, 100, 0), 0);
    assert.equal(overlayByte(0, 100, 1), 100);
    assert.equal(overlayByte(0, 100, 0.5), 50);
    assert.equal(overlayByte(10, 40, -2), 10);
    assert.equal(clampFade(Number.NaN), 0);
    assert.equal(COMPARISON_FILENAME.endsWith(".png"), true);
    assert.equal(COMPARISON_FILENAME.includes("sketchy"), false);
  });

  it("does not pretend adjustments are visible", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    project = image(project, createId, "asset_a", "only.png", 10);
    const source = listCompareSources(project)[0]!;
    const slot = { objectId: source.objectId, view: "edited" as const };
    assert.equal(slotSkipsAdjustments(project, slot), false);
    const edit = project.imageProjects[source.imageProjectId]!;
    project = {
      ...project,
      imageProjects: {
        ...project.imageProjects,
        [source.imageProjectId]: { ...edit, adjustments: { ...defaultAdjustments(), brightness: 0.4 } },
      },
    };
    assert.equal(slotSkipsAdjustments(project, slot), true);
    assert.equal(slotSkipsAdjustments(project, { ...slot, view: "original" }), false);
    assert.equal(project.assets.asset_a?.byteLength, 10);
  });
});
