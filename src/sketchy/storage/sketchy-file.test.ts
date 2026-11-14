import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { createProject } from "../model/document.ts";
import { addDrawing, insertImage, setImageMask } from "../model/ops.ts";
import type { DrawingObject, IdFactory } from "../model/types.ts";
import { packSketchy, sketchyFilename, unpackSketchy } from "./sketchy-file.ts";

function ids(): IdFactory {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

async function sampleProject() {
  const createId = ids();
  let project = createProject({ name: "Round trip", now: "2026-11-14T00:00:00.000Z", createId });
  project = insertImage(
    project,
    {
      asset: { id: "asset_shot", mime: "image/png", width: 40, height: 20, byteLength: 5, name: "shot.png" },
      x: 1,
      y: 2,
      width: 40,
      height: 20,
    },
    createId,
  );
  const image = project.boards[0]!.objects.find((object) => object.type === "image");
  assert.ok(image && image.type === "image");
  if (!image || image.type !== "image") throw new Error("missing image");
  const mark: DrawingObject = {
    id: "draw_keep",
    kind: "text",
    x: 3,
    y: 4,
    rotation: 0,
    text: "Still editable",
    fontSize: 12,
    stroke: "#111111",
    fill: "#111111",
    strokeWidth: 2,
    opacity: 1,
  };
  project = addDrawing(project, image.imageProjectId, mark);
  project = setImageMask(project, image.imageProjectId, {
    kind: "polygon",
    points: [0.1, 0.1, 0.9, 0.2, 0.7, 0.9],
    mode: "remove-outside",
  });
  return project;
}

describe("sketchy file", () => {
  it("round-trips the mask, the drawing, and the original bytes", async () => {
    const project = await sampleProject();
    const original = new Blob([Uint8Array.from([9, 8, 7, 6, 5])], { type: "image/png" });
    const packed = await packSketchy(project, new Map([["asset_shot", original]]));
    const opened = await unpackSketchy(await packed.arrayBuffer());
    const edit = Object.values(opened.project.imageProjects)[0];
    assert.equal(edit?.mask?.kind, "polygon");
    assert.equal(edit?.drawings[0]?.text, "Still editable");
    assert.equal(opened.project.assets.asset_shot?.byteLength, 5);
    assert.deepEqual(opened.missing, []);
    const file = opened.files.get("asset_shot");
    assert.ok(file);
    assert.deepEqual(new Uint8Array(await file!.arrayBuffer()), Uint8Array.from([9, 8, 7, 6, 5]));
    assert.equal(sketchyFilename("My board"), "My-board.sketchy");
  });

  it("reports a missing original and rejects a file that is not a Sketchy project", async () => {
    const project = await sampleProject();
    const packed = await packSketchy(project, new Map());
    const opened = await unpackSketchy(await packed.arrayBuffer());
    assert.deepEqual(opened.missing, ["asset_shot"]);
    assert.equal(opened.project.imageProjects[Object.keys(opened.project.imageProjects)[0]!]?.drawings.length, 1);

    const zip = new JSZip();
    zip.file("readme.txt", "not a project");
    await assert.rejects(unpackSketchy(await zip.generateAsync({ type: "arraybuffer" })), /manifest.json/);

    const fake = new JSZip();
    fake.file("manifest.json", "{}");
    await assert.rejects(unpackSketchy(await fake.generateAsync({ type: "arraybuffer" })), /Not a Sketchy project/);

    await assert.rejects(unpackSketchy(Uint8Array.from([137, 80, 78, 71]).buffer), /not a \.sketchy archive/);
  });
});
