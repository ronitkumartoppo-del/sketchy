import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createProject, parseProject, serializeProject } from "./document.ts";
import { worldCenter } from "./geometry.ts";
import { createId } from "./ids.ts";
import {
  addConnector,
  addObject,
  duplicateObjects,
  groupObjects,
  moveObject,
  removeObjects,
  ungroupObjects,
} from "./ops.ts";
import type { FrameObject, IdFactory, RectObject } from "./types.ts";

function ids(): IdFactory {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

function rect(id: string, x: number, y: number): RectObject {
  return {
    id,
    type: "rect",
    x,
    y,
    rotation: 0,
    locked: false,
    width: 30,
    height: 10,
    fill: "transparent",
    stroke: "#111111",
    strokeWidth: 2,
  };
}

describe("groups, frames, and connectors", () => {
  it("groups two shapes, moves them together, and ungroups back to the board", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    project = addObject(project, rect("a", 10, 20));
    project = addObject(project, rect("b", 50, 20));
    const before = worldCenter(project.boards[0]!.objects, "a");
    const grouped = groupObjects(project, ["a", "b"], createId);
    assert.ok(grouped.id);
    project = grouped.project;
    const group = project.boards[0]!.objects.find((object) => object.id === grouped.id);
    assert.ok(group && group.type === "group");
    if (!group || group.type !== "group") return;
    const childA = project.boards[0]!.objects.find((object) => object.id === "a");
    assert.equal(childA?.x, 0);
    assert.equal(worldCenter(project.boards[0]!.objects, "a")?.x, before?.x);
    assert.equal(worldCenter(project.boards[0]!.objects, "a")?.y, before?.y);

    project = moveObject(project, group.id, group.x + 15, group.y);
    assert.equal(worldCenter(project.boards[0]!.objects, "a")?.x, (before?.x ?? 0) + 15);
    assert.equal(project.boards[0]!.objects.find((object) => object.id === "a")?.x, 0);

    const released = ungroupObjects(project, [group.id]);
    assert.deepEqual(released.ids.sort(), ["a", "b"]);
    const restored = released.project.boards[0]!.objects.find((object) => object.id === "a");
    assert.equal(restored?.x, 25);
    assert.equal(restored?.y, 20);
    assert.equal(released.project.boards[0]!.objects.some((object) => object.type === "group"), false);
  });

  it("does not group objects that live in different parents", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    const frame: FrameObject = {
      id: "frame",
      type: "frame",
      x: 0,
      y: 0,
      rotation: 0,
      locked: false,
      name: "Story",
      width: 200,
      height: 200,
      fill: "#fffdf8",
      childIds: [],
    };
    project = addObject(project, frame);
    project = addObject(project, rect("inside", 20, 20));
    project = addObject(project, rect("outside", 400, 400));
    const frameAfter = project.boards[0]!.objects.find((object) => object.id === "frame");
    assert.ok(frameAfter && frameAfter.type === "frame");
    assert.deepEqual(frameAfter?.type === "frame" ? frameAfter.childIds : [], ["inside"]);
    assert.equal(project.boards[0]!.objects.find((object) => object.id === "inside")?.x, 20);
    const grouped = groupObjects(project, ["inside", "outside"], createId);
    assert.equal(grouped.id, null);
    assert.equal(grouped.project, project);
  });

  it("keeps a connector attached when one end moves, and drops it when that end is deleted", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    project = addObject(project, rect("a", 0, 0));
    project = addObject(project, rect("b", 80, 0));
    const linked = addConnector(project, "a", "b", "#2347d6", createId);
    assert.ok(linked.id);
    project = linked.project;
    const start = worldCenter(project.boards[0]!.objects, "a");
    project = moveObject(project, "a", 20, 0);
    assert.equal(worldCenter(project.boards[0]!.objects, "a")?.x, (start?.x ?? 0) + 20);
    const connector = project.boards[0]!.objects.find((object) => object.id === linked.id);
    assert.equal(connector?.type, "connector");
    if (connector?.type === "connector") {
      assert.equal(connector.fromId, "a");
      assert.equal(connector.toId, "b");
    }
    project = removeObjects(project, ["a"]);
    assert.equal(project.boards[0]!.objects.some((object) => object.id === "a"), false);
    assert.equal(project.boards[0]!.objects.some((object) => object.id === linked.id), false);
    assert.equal(project.boards[0]!.objects.some((object) => object.id === "b"), true);
  });

  it("deletes a group without flattening an image, and a duplicate keeps the original asset", () => {
    const createId = ids();
    let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId });
    project = {
      ...project,
      assets: {
        asset_shot: { id: "asset_shot", mime: "image/png", width: 20, height: 10, byteLength: 40 },
      },
      imageProjects: {},
    };
    project = addObject(project, {
      id: "pic",
      type: "image",
      x: 0,
      y: 0,
      rotation: 0,
      locked: false,
      width: 20,
      height: 10,
      assetId: "asset_shot",
      imageProjectId: "edit_pic",
    });
    project = {
      ...project,
      imageProjects: {
        edit_pic: {
          id: "edit_pic",
          assetId: "asset_shot",
          adjustments: project.imageProjects.edit_pic?.adjustments ?? {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            grayscale: false,
            blur: 0,
            pixelate: 1,
            rotation: 0,
            flipX: false,
            flipY: false,
          },
          mask: null,
          drawings: [],
        },
      },
    };
    project = addObject(project, rect("note", 40, 0));
    const grouped = groupObjects(project, ["pic", "note"], createId);
    assert.ok(grouped.id);
    project = grouped.project;
    assert.equal(project.assets.asset_shot?.byteLength, 40);
    const copy = duplicateObjects(project, [grouped.id!], createId);
    const clone = copy.project.boards[0]!.objects.find((object) => object.id === copy.ids[0]);
    assert.ok(clone && clone.type === "group");
    if (!clone || clone.type !== "group") return;
    assert.notEqual(clone.childIds[0], "pic");
    const clonedImage = copy.project.boards[0]!.objects.find((object) => object.id === clone.childIds[0]);
    assert.equal(clonedImage?.type === "image" ? clonedImage.assetId : "", "asset_shot");
    assert.equal(copy.project.assets.asset_shot?.byteLength, 40);
    const removed = removeObjects(copy.project, [grouped.id!]);
    assert.equal(removed.boards[0]!.objects.some((object) => object.id === "pic"), false);
    assert.equal(removed.assets.asset_shot?.byteLength, 40);
    const again = parseProject(serializeProject(copy.project));
    assert.equal(again.boards[0]!.objects.some((object) => object.type === "connector"), false);
    assert.equal(again.boards[0]!.objects.filter((object) => object.type === "group").length, 2);
  });
});
