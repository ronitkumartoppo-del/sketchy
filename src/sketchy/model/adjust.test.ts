import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adjustmentsAreDefault, clampAdjustments, colorFilter } from "./adjust.ts";
import { createProject, defaultAdjustments } from "./document.ts";
import { insertImage, setImageAdjustments } from "./ops.ts";
import type { IdFactory } from "./types.ts";

function ids(): IdFactory {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

describe("adjustments", () => {
  it("builds a filter only when a color control moved", () => {
    assert.equal(colorFilter(defaultAdjustments()), null);
    assert.equal(colorFilter({ ...defaultAdjustments(), brightness: 0.5 }), "brightness(1.5)");
    assert.equal(colorFilter({ ...defaultAdjustments(), grayscale: true, blur: 4 }), "grayscale(1) blur(4px)");
    assert.equal(adjustmentsAreDefault(defaultAdjustments()), true);
    const clamped = clampAdjustments({ ...defaultAdjustments(), brightness: 4, pixelate: 0, rotation: -90 });
    assert.equal(clamped.brightness, 1);
    assert.equal(clamped.pixelate, 1);
    assert.equal(clamped.rotation, 270);
  });

  it("stores adjustments on the edit project and leaves the original bytes alone", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    project = insertImage(
      project,
      {
        asset: { id: "asset_a", mime: "image/png", width: 80, height: 40, byteLength: 551, name: "cobalt.png" },
        x: 0,
        y: 0,
        width: 80,
        height: 40,
      },
      createId,
    );
    const image = project.boards[0]!.objects.find((object) => object.type === "image");
    assert.ok(image && image.type === "image");
    if (!image || image.type !== "image") return;
    const next = setImageAdjustments(project, image.imageProjectId, { ...defaultAdjustments(), brightness: -1, flipX: true });
    assert.equal(next.imageProjects[image.imageProjectId]?.adjustments.brightness, -1);
    assert.equal(next.imageProjects[image.imageProjectId]?.adjustments.flipX, true);
    assert.equal(next.assets.asset_a?.byteLength, 551);
    assert.equal(next.assets.asset_a?.width, 80);
    assert.equal(project.imageProjects[image.imageProjectId]?.adjustments.brightness, 0);
  });
});
