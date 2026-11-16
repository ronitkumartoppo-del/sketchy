import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bakeBoardTransform,
  denormalizePoints,
  normalizePoints,
  pointInPolygon,
  screenToWorld,
  simplifyRdp,
  zoomAt,
} from "./geometry.ts";
import type { RectObject } from "./types.ts";

describe("camera zoom", () => {
  it("keeps the world point under the cursor stable", () => {
    const camera = { x: 20, y: -10, scale: 1 };
    const screen = { x: 180, y: 90 };
    const before = screenToWorld(camera, screen);
    const next = zoomAt(camera, screen, -120);
    const after = screenToWorld(next, screen);
    assert.ok(Math.abs(before.x - after.x) < 1e-9);
    assert.ok(Math.abs(before.y - after.y) < 1e-9);
    assert.ok(next.scale > camera.scale);
  });
});

describe("polygon mask geometry", () => {
  const square = [0, 0, 10, 0, 10, 10, 0, 10];

  it("knows when a point is inside a polygon", () => {
    assert.equal(pointInPolygon(5, 5, square), true);
    assert.equal(pointInPolygon(15, 5, square), false);
  });

  it("round-trips normalized points", () => {
    const normalized = normalizePoints([50, 25, 100, 0], 200, 50);
    assert.deepEqual(normalized, [0.25, 0.5, 0.5, 0]);
    assert.deepEqual(denormalizePoints(normalized, 200, 50), [50, 25, 100, 0]);
  });

  it("simplifies a lasso without dropping the closure", () => {
    const ring = [0, 0, 1, 0.1, 2, -0.1, 10, 0, 10, 10, 0, 10, 0, 0];
    const simplified = simplifyRdp(ring, 0.5);
    assert.ok(simplified.length < ring.length);
    assert.equal(simplified[0], simplified[simplified.length - 2]);
    assert.equal(simplified[1], simplified[simplified.length - 1]);
    assert.equal(pointInPolygon(5, 5, simplified), true);
  });
});

describe("bakeBoardTransform", () => {
  it("bakes scale into width and height and clears nothing else", () => {
    const rect: RectObject = {
      id: "a",
      type: "rect",
      x: 1,
      y: 2,
      rotation: 0,
      locked: false,
      width: 40,
      height: 20,
      fill: "transparent",
      stroke: "#111",
      strokeWidth: 2,
    };
    const baked = bakeBoardTransform(rect, { x: 5, y: 6, rotation: 15, scaleX: 2, scaleY: 3 });
    assert.equal(baked.type, "rect");
    if (baked.type !== "rect") return;
    assert.equal(baked.width, 80);
    assert.equal(baked.height, 60);
    assert.equal(baked.x, 5);
    assert.equal(baked.rotation, 15);
    assert.equal(baked.stroke, "#111");
  });
});
