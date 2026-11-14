import { toast } from "sonner";
import { activeBoard } from "../model/document";
import { createId } from "../model/ids";
import { screenToWorld } from "../model/geometry";
import { displayPixelSize } from "../model/display";
import { displayObjectUrl } from "./display-bitmap";
import { insertImage } from "../model/ops";
import type { AssetRecord } from "../model/types";
import { useSketchy } from "../store/use-sketchy";
import { idbPutBlob } from "../storage/idb";

export const viewSize = { width: 1, height: 1 };

const SUPPORTED = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isSupportedImage(file: { type: string; name?: string }): boolean {
  if (SUPPORTED.has(file.type)) return true;
  return /\.(png|jpe?g|webp)$/i.test(file.name ?? "");
}

export async function importImageFiles(files: Iterable<File>): Promise<void> {
  const list = [...files];
  let offset = 0;
  for (const file of list) {
    await importImageBlob(file, file.name, offset);
    offset += 36;
  }
}

export async function importImageBlob(blob: Blob, name?: string, offset = 0): Promise<void> {
  if (!isSupportedImage({ type: blob.type, name })) {
    toast.error("Sketchy opens PNG, JPG, and WebP images.");
    return;
  }
  const bitmap = await createImageBitmap(blob);
  const naturalW = bitmap.width;
  const naturalH = bitmap.height;
  bitmap.close();
  const assetId = createId("asset");
  const asset: AssetRecord = {
    id: assetId,
    mime: blob.type || "image/png",
    width: naturalW,
    height: naturalH,
    byteLength: blob.size,
    name,
  };
  try {
    await idbPutBlob(assetId, blob);
  } catch (error) {
    console.error(error);
    toast.error("Couldn't store that image in this browser. It will last until you reload.");
  }
  const url = URL.createObjectURL(blob);
  const store = useSketchy.getState();
  store.rememberAssetUrl(assetId, url);
  const displayUrl = await displayObjectUrl(blob, naturalW, naturalH);
  if (displayUrl) useSketchy.getState().replaceDisplayUrls({ ...useSketchy.getState().displayUrls, [assetId]: displayUrl });
  const camera = activeBoard(store.history.present).camera;
  const fitted = displayPixelSize(naturalW, naturalH);
  const width = Math.max(8, fitted.width);
  const height = Math.max(8, fitted.height);
  const center = screenToWorld(camera, { x: viewSize.width / 2, y: viewSize.height / 2 });
  const before = new Set(activeBoard(store.history.present).objects.map((object) => object.id));
  store.commit((project) =>
    insertImage(
      project,
      { asset, x: center.x - width / 2 + offset, y: center.y - height / 2 + offset, width, height },
      createId,
    ),
  );
  const created = activeBoard(useSketchy.getState().history.present).objects.find((object) => !before.has(object.id));
  useSketchy.getState().setTool("select");
  if (created) useSketchy.getState().selectOnly(created.id);
}
