import { colorFilter } from "../model/adjust";
import { denormalizePoints } from "../model/geometry";
import { effectiveMaskMode } from "../model/mask";
import type { Adjustments, ImageMask } from "../model/types";

/** Draws the bitmap, then adjustments, then the mask. Does not change the source image. */
export function paintPhoto(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  width: number,
  height: number,
  adjustments: Adjustments,
  mask: ImageMask | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || width < 1 || height < 1) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  const turned = adjustments.rotation % 360 !== 0 || adjustments.flipX || adjustments.flipY;
  if (turned) {
    ctx.translate(width / 2, height / 2);
    ctx.rotate((adjustments.rotation * Math.PI) / 180);
    ctx.scale(adjustments.flipX ? -1 : 1, adjustments.flipY ? -1 : 1);
    ctx.translate(-width / 2, -height / 2);
  }
  const filter = colorFilter(adjustments);
  if (filter) ctx.filter = filter;
  ctx.drawImage(image, 0, 0, width, height);
  ctx.restore();
  ctx.filter = "none";
  if (adjustments.pixelate > 1) pixelate(canvas, adjustments.pixelate);
  if (mask) applyMask(canvas, mask);
}

function pixelate(canvas: HTMLCanvasElement, block: number) {
  const width = canvas.width;
  const height = canvas.height;
  const sw = Math.max(1, Math.round(width / block));
  const sh = Math.max(1, Math.round(height / block));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const source = small.getContext("2d");
  const ctx = canvas.getContext("2d");
  if (!source || !ctx) return;
  source.imageSmoothingEnabled = false;
  source.drawImage(canvas, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(small, 0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
}

function applyMask(canvas: HTMLCanvasElement, mask: ImageMask) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.globalCompositeOperation = effectiveMaskMode(mask) === "remove-inside" ? "destination-out" : "destination-in";
  ctx.beginPath();
  if (mask.kind === "rect") {
    ctx.rect(mask.x * width, mask.y * height, Math.max(0, mask.w * width), Math.max(0, mask.h * height));
  } else {
    const pts = denormalizePoints(mask.points, width, height);
    if (pts.length < 6) {
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    ctx.moveTo(pts[0] ?? 0, pts[1] ?? 0);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0);
    ctx.closePath();
  }
  ctx.fill("evenodd");
  ctx.globalCompositeOperation = "source-over";
}
