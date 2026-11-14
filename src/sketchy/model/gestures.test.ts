import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pinchFrom, pinchMove } from "./gestures.ts";
import { screenToWorld } from "./geometry.ts";

describe("two-finger pinch", () => {
  it("zooms in around the midpoint and does not start from one finger", () => {
    assert.equal(pinchFrom([{ x: 10, y: 10 }]), null);
    const pinch = pinchFrom([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    assert.ok(pinch);
    if (!pinch) return;
    const camera = { x: 0, y: 0, scale: 1 };
    const moved = pinchMove(camera, pinch, [
      { x: 0, y: 20 },
      { x: 200, y: 20 },
    ]);
    assert.ok(moved);
    if (!moved) return;
    assert.ok(moved.camera.scale > 1.9 && moved.camera.scale < 2.1);
    const before = screenToWorld(camera, pinch.lastCenter);
    const after = screenToWorld(moved.camera, { x: 100, y: 20 });
    assert.ok(Math.abs(before.x - after.x) < 0.01);
    assert.ok(Math.abs(before.y - after.y) < 0.01);
  });
});
