import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cubicPoint, curvePoints } from "./curve.ts";
import { createProject, parseProject, serializeProject } from "./document.ts";
import { addObject } from "./ops.ts";

describe("curves", () => {
  it("bows off the straight chord and survives a project round trip", () => {
    const points = curvePoints({ x: 120, y: 0 });
    assert.equal(points.length, 8);
    assert.equal(points[0], 0);
    assert.equal(points[6], 120);
    const mid = cubicPoint(points, 0.5);
    assert.ok(Math.abs(mid.y) > 10, `expected a bow, got y=${mid.y}`);
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId: () => "id" });
    project = addObject(project, {
      id: "curve",
      type: "curve",
      x: 12,
      y: 8,
      rotation: 0,
      locked: false,
      points,
      stroke: "#1a1814",
      strokeWidth: 2.5,
    });
    const again = parseProject(serializeProject(project));
    const stored = again.boards[0]!.objects.find((object) => object.id === "curve");
    assert.equal(stored?.type, "curve");
    if (stored?.type === "curve") assert.equal(stored.points[2], points[2]);
  });
});
