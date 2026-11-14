import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { connectorsForFrame, frameExportPixels, imageExportPixels, PICTURE_FILES } from "./export.ts";
import type { BoardObject } from "./types.ts";

function near(point: { x: number; y: number }, x: number, y: number) {
  assert.ok(Math.abs(point.x - x) < 0.001 && Math.abs(point.y - y) < 0.001, `${point.x},${point.y} != ${x},${y}`);
}

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

  it("draws connectors that touch a frame, in that frame's coordinates", () => {
    const objects: BoardObject[] = [
      {
        id: "frame",
        type: "frame",
        name: "Story",
        x: 100,
        y: 40,
        rotation: 90,
        locked: false,
        width: 200,
        height: 100,
        fill: "#fffdf8",
        childIds: ["a", "group"],
      },
      {
        id: "a",
        type: "rect",
        x: 10,
        y: 20,
        rotation: 0,
        locked: false,
        width: 20,
        height: 10,
        fill: "transparent",
        stroke: "#1a1814",
        strokeWidth: 2,
      },
      {
        id: "group",
        type: "group",
        x: 30,
        y: 0,
        rotation: 0,
        locked: false,
        width: 40,
        height: 20,
        childIds: ["b"],
      },
      {
        id: "b",
        type: "rect",
        x: 8,
        y: 8,
        rotation: 0,
        locked: false,
        width: 4,
        height: 4,
        fill: "transparent",
        stroke: "#1a1814",
        strokeWidth: 2,
      },
      {
        id: "out",
        type: "ellipse",
        x: 0,
        y: 0,
        rotation: 0,
        locked: false,
        width: 10,
        height: 10,
        fill: "transparent",
        stroke: "#1a1814",
        strokeWidth: 2,
      },
      {
        id: "other",
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
      },
      {
        id: "link",
        type: "connector",
        x: 0,
        y: 0,
        rotation: 0,
        locked: false,
        fromId: "a",
        toId: "b",
        stroke: "#e23d2b",
        strokeWidth: 3,
      },
      {
        id: "cross",
        type: "connector",
        x: 0,
        y: 0,
        rotation: 0,
        locked: false,
        fromId: "a",
        toId: "out",
        stroke: "#2347d6",
        strokeWidth: 2,
      },
      {
        id: "away",
        type: "connector",
        x: 0,
        y: 0,
        rotation: 0,
        locked: false,
        fromId: "out",
        toId: "other",
        stroke: "#1f7a4d",
        strokeWidth: 2,
      },
    ];
    const lines = connectorsForFrame(objects, "frame");
    assert.deepEqual(
      lines.map((line) => line.id),
      ["link", "cross"],
    );
    const link = lines[0]!;
    near(link.from, 20, 25);
    near(link.to, 40, 10);
    assert.equal(link.stroke, "#e23d2b");
    const cross = lines[1]!;
    near(cross.from, 20, 25);
    assert.equal(cross.to.x >= 0 && cross.to.x <= 200 && cross.to.y >= 0 && cross.to.y <= 100, false);
  });
});
