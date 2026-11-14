import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unreachableBlobIds } from "./assets.ts";
import { createHistory, historyCommit } from "./history.ts";
import { addObject, removeObjects } from "./ops.ts";
import { createProject } from "./document.ts";
import type { SketchyProject } from "./types.ts";

function withShot(): SketchyProject {
  let project = createProject({ now: "2026-11-14T00:00:00.000Z", createId: () => "unused" });
  project = {
    ...project,
    assets: {
      asset_shot: { id: "asset_shot", mime: "image/png", width: 80, height: 40, byteLength: 171 },
    },
    imageProjects: {
      edit_pic: {
        id: "edit_pic",
        assetId: "asset_shot",
        adjustments: {
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
  return addObject(project, {
    id: "pic",
    type: "image",
    x: 0,
    y: 0,
    rotation: 0,
    locked: false,
    width: 80,
    height: 40,
    assetId: "asset_shot",
    imageProjectId: "edit_pic",
  });
}

describe("deleted images and their bytes", () => {
  it("drops the asset from the current project and keeps it while undo can reach it", () => {
    const original = withShot();
    let history = createHistory(original, 2);
    const deleted = removeObjects(original, ["pic"]);
    assert.equal(deleted.boards[0]!.objects.length, 0);
    assert.equal(deleted.assets.asset_shot, undefined);
    assert.equal(deleted.imageProjects.edit_pic, undefined);
    history = historyCommit(history, deleted);
    assert.deepEqual(unreachableBlobIds(["asset_shot", "asset_other"], [history.present, ...history.past, ...history.future]), [
      "asset_other",
    ]);
    history = historyCommit(history, { ...deleted, name: "still gone" });
    history = historyCommit(history, { ...deleted, name: "still gone 2" });
    assert.deepEqual(
      unreachableBlobIds(["asset_shot"], [history.present, ...history.past, ...history.future]),
      ["asset_shot"],
    );
  });

  it("keeps a shared file when another image still uses it", () => {
    const project = withShot();
    const copy = addObject(project, {
      id: "pic_b",
      type: "image",
      x: 30,
      y: 0,
      rotation: 0,
      locked: false,
      width: 80,
      height: 40,
      assetId: "asset_shot",
      imageProjectId: "edit_pic",
    });
    const removed = removeObjects(copy, ["pic"]);
    assert.equal(removed.assets.asset_shot?.byteLength, 171);
    assert.equal(removed.imageProjects.edit_pic?.assetId, "asset_shot");
  });
});
