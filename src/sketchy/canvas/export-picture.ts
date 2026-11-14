import { toast } from "sonner";
import { activeBoard } from "../model/document";
import { connectorsForFrame, frameExportPixels, imageExportPixels, PICTURE_FILES } from "../model/export";
import { useSketchy } from "../store/use-sketchy";
import { renderEditedImage } from "./raster";

function saveUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't read that image."));
    image.src = url;
  });
}

/** A PNG of one image at its original size. Does not replace the file in the project. */
export async function downloadEditedPicture(imageProjectId: string): Promise<void> {
  const state = useSketchy.getState();
  const project = state.history.present;
  const edit = project.imageProjects[imageProjectId];
  const asset = edit ? project.assets[edit.assetId] : undefined;
  const url = edit ? state.assetUrls[edit.assetId] : undefined;
  if (!edit || !asset || !url) {
    toast.error("That image isn't in this browser.");
    return;
  }
  const before = asset.byteLength;
  const pixels = imageExportPixels(asset);
  try {
    const image = await loadImage(url);
    const canvas = renderEditedImage({
      image,
      width: pixels.width,
      height: pixels.height,
      adjustments: edit.adjustments,
      mask: edit.mask,
      drawings: edit.drawings,
    });
    if (canvas.width !== pixels.width || canvas.height !== pixels.height) {
      toast.error("This image is too large to save as a PNG in this browser.");
      return;
    }
    saveUrl(canvas.toDataURL("image/png"), PICTURE_FILES.image);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Couldn't save that picture.");
    return;
  }
  const after = useSketchy.getState().history.present.assets[asset.id]?.byteLength;
  if (after !== before) {
    toast.error("The original file changed. That should not happen.");
    return;
  }
  toast.success("Downloaded a PNG of this image at its original size. It is not the editable project.");
}

/** A PNG of a frame, the objects inside it, and connectors that touch it. */
export async function downloadFramePicture(frameId: string): Promise<void> {
  const board = activeBoard(useSketchy.getState().history.present);
  const frame = board.objects.find((object) => object.id === frameId);
  if (!frame || frame.type !== "frame") return;
  const { default: Konva } = await import("konva");
  const node = Konva.stages.map((stage) => stage.findOne(`#${frameId}`)).find((found) => Boolean(found));
  if (!node) {
    toast.error("Open the board to save this frame.");
    return;
  }
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  document.body.appendChild(host);
  const clone = node.clone();
  clone.x(0);
  clone.y(0);
  clone.rotation(0);
  clone.scale({ x: 1, y: 1 });
  const off = new Konva.Stage({ container: host, width: frame.width, height: frame.height });
  const layer = new Konva.Layer();
  off.add(layer);
  layer.add(clone);
  for (const line of connectorsForFrame(board.objects, frame.id)) {
    layer.add(
      new Konva.Arrow({
        points: [line.from.x, line.from.y, line.to.x, line.to.y],
        stroke: line.stroke,
        fill: line.stroke,
        strokeWidth: line.strokeWidth,
        pointerLength: 14,
        pointerWidth: 14,
        lineCap: "round",
        listening: false,
      }),
    );
  }
  const pixels = frameExportPixels(frame);
  const url = off.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
  off.destroy();
  host.remove();
  saveUrl(url, PICTURE_FILES.frame);
  toast.success(
    `Downloaded a ${pixels.width}×${pixels.height} PNG of this frame. It is not the editable project.`,
  );
}
