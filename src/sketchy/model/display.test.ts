import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayPixelSize, needsDisplayBitmap } from "./display.ts";

describe("board display size", () => {
  it("shrinks a large photo for the board and leaves a small one alone", () => {
    assert.deepEqual(displayPixelSize(2000, 1000), { width: 560, height: 280 });
    assert.deepEqual(displayPixelSize(80, 40), { width: 80, height: 40 });
    assert.equal(needsDisplayBitmap(2000, 1000), true);
    assert.equal(needsDisplayBitmap(80, 40), false);
    assert.equal(needsDisplayBitmap(560, 200), false);
  });
});
