import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { frameExportPixels, imageExportPixels, PICTURE_FILES } from "./export.ts";

describe("picture export", () => {
  it("saves an image at the original pixel size, not the board size", () => {
    const board = { width: 560, height: 373 };
    const pixels = imageExportPixels({ width: 240, height: 160 });
    assert.deepEqual(pixels, { width: 240, height: 160 });
    assert.notEqual(pixels.width, board.width);
    assert.equal(PICTURE_FILES.image.endsWith(".png"), true);
    assert.equal(PICTURE_FILES.image.includes("sketchy"), true);
    assert.equal(PICTURE_FILES.image.endsWith(".sketchy"), false);
  });

  it("saves a frame at twice the artboard size", () => {
    assert.deepEqual(frameExportPixels({ width: 270, height: 480 }), { width: 540, height: 960 });
    assert.equal(PICTURE_FILES.frame.endsWith(".png"), true);
    assert.equal(PICTURE_FILES.view.endsWith(".png"), true);
  });
});
