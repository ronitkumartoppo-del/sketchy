import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createProject } from "./document.ts";
import { maskKeepsPixel, polygonMaskFromPixels, rectMaskFromPixels } from "./mask.ts";
import { addDrawing, insertImage, setImageMask } from "./ops.ts";
import type { DrawingObject, IdFactory } from "./types.ts";

function ids(): IdFactory {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

const square = {
  kind: "polygon" as const,
  points: [0.25, 0.25, 0.75, 0.25, 0.75, 0.75, 0.25, 0.75],
  mode: "remove-outside" as const,
};

describe("freeform mask", () => {
  it("hides pixels outside a keep-inside crop and inverts a cut-out", () => {
    assert.equal(maskKeepsPixel(square, 50, 50, 100, 100), true);
    assert.equal(maskKeepsPixel(square, 5, 5, 100, 100), false);
    assert.equal(maskKeepsPixel({ ...square, mode: "keep" }, 50, 50, 100, 100), true);
    assert.equal(maskKeepsPixel({ ...square, mode: "remove-inside" }, 50, 50, 100, 100), false);
    assert.equal(maskKeepsPixel({ ...square, mode: "remove-inside" }, 5, 5, 100, 100), true);
    assert.equal(maskKeepsPixel(null, 5, 5, 100, 100), true);
  });

  it("stores a lasso normalized, and a rect crop in unit space", () => {
    const lasso = polygonMaskFromPixels([10, 10, 80, 12, 78, 70, 12, 68, 10, 10], 100, 100, "remove-outside");
    assert.ok(lasso && lasso.kind === "polygon");
    if (!lasso || lasso.kind !== "polygon") return;
    assert.ok(lasso.points.every((value) => value >= 0 && value <= 1));
    assert.equal(maskKeepsPixel(lasso, 40, 40, 100, 100), true);
    assert.equal(maskKeepsPixel(lasso, 2, 2, 100, 100), false);
    assert.equal(polygonMaskFromPixels([1, 1, 2, 2], 100, 100, "remove-outside"), null);

    const rect = rectMaskFromPixels(10, 20, 60, 80, 100, 100, "remove-inside");
    assert.ok(rect && rect.kind === "rect");
    if (!rect || rect.kind !== "rect") return;
    assert.equal(rect.x, 0.1);
    assert.equal(rect.w, 0.5);
    assert.equal(maskKeepsPixel(rect, 30, 40, 100, 100), false);
    assert.equal(maskKeepsPixel(rect, 5, 5, 100, 100), true);
  });

  it("writes the mask only — asset bytes and drawings stay", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    project = insertImage(
      project,
      {
        asset: { id: "asset_shot", mime: "image/png", width: 200, height: 100, byteLength: 90, name: "shot.png" },
        x: 0,
        y: 0,
        width: 200,
        height: 100,
      },
      createId,
    );
    const image = project.boards[0]!.objects.find((object) => object.type === "image");
    assert.ok(image && image.type === "image");
    if (!image || image.type !== "image") return;
    const mark: DrawingObject = {
      id: "draw_keep",
      kind: "rect",
      x: 4,
      y: 4,
      rotation: 0,
      width: 12,
      height: 8,
      stroke: "#111111",
      fill: "transparent",
      strokeWidth: 2,
      opacity: 1,
    };
    project = addDrawing(project, image.imageProjectId, mark);
    const cropped = setImageMask(project, image.imageProjectId, square);
    assert.equal(cropped.assets.asset_shot?.byteLength, 90);
    assert.equal(cropped.assets.asset_shot?.width, 200);
    assert.equal(cropped.imageProjects[image.imageProjectId]?.drawings[0]?.id, "draw_keep");
    assert.equal(cropped.imageProjects[image.imageProjectId]?.mask?.kind, "polygon");
    assert.equal(project.imageProjects[image.imageProjectId]?.mask, null);
  });
});
