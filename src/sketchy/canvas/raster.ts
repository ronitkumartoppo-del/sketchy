import { colorFilter } from "../model/adjust";
import { denormalizePoints } from "../model/geometry";
import { effectiveMaskMode } from "../model/mask";
import { palette } from "../model/palette";
import type { Adjustments, DrawingObject, ImageMask } from "../model/types";

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

/** Original pixels, then adjustments, then the mask, then the drawings. The source image is not written. */
export function renderEditedImage(input: {
  image: CanvasImageSource;
  width: number;
  height: number;
  adjustments: Adjustments;
  mask: ImageMask | null;
  drawings: DrawingObject[];
}): HTMLCanvasElement {
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(input.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paintPhoto(canvas, input.image, width, height, input.adjustments, input.mask);
  const ctx = canvas.getContext("2d");
  if (!ctx || input.drawings.length === 0) return canvas;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  for (const drawing of input.drawings) paintDrawing(ctx, drawing);
  ctx.restore();
  return canvas;
}

export function paintDrawing(ctx: CanvasRenderingContext2D, drawing: DrawingObject) {
  ctx.save();
  ctx.translate(drawing.x, drawing.y);
  ctx.rotate((drawing.rotation * Math.PI) / 180);
  ctx.globalAlpha = drawing.opacity;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.strokeStyle = drawing.stroke;
  ctx.fillStyle = drawing.fill;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const canFill = drawing.fill !== "transparent";
  const canStroke = drawing.stroke !== "transparent" && drawing.strokeWidth > 0;
  if (drawing.kind === "rect") {
    const w = drawing.width ?? 0;
    const h = drawing.height ?? 0;
    if (canFill) ctx.fillRect(0, 0, w, h);
    if (canStroke) ctx.strokeRect(0, 0, w, h);
  } else if (drawing.kind === "ellipse") {
    const w = drawing.width ?? 0;
    const h = drawing.height ?? 0;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, Math.max(0.5, Math.abs(w) / 2), Math.max(0.5, Math.abs(h) / 2), 0, 0, Math.PI * 2);
    if (canFill) ctx.fill();
    if (canStroke) ctx.stroke();
  } else if (drawing.kind === "text") {
    ctx.fillStyle = drawing.fill === "transparent" ? drawing.stroke : drawing.fill;
    ctx.font = `${drawing.fontSize ?? 28}px Outfit, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(drawing.text ?? "", 0, 0, drawing.width ?? 160);
  } else if (drawing.kind === "bezier") {
    const pts = drawing.points ?? [];
    if (pts.length >= 8 && canStroke) {
      ctx.beginPath();
      ctx.moveTo(pts[0] ?? 0, pts[1] ?? 0);
      ctx.bezierCurveTo(pts[2] ?? 0, pts[3] ?? 0, pts[4] ?? 0, pts[5] ?? 0, pts[6] ?? 0, pts[7] ?? 0);
      ctx.stroke();
    }
  } else if (drawing.kind === "polygon" || drawing.kind === "arrow" || drawing.points) {
    const closed = drawing.kind === "polygon";
    trace(ctx, drawing.points ?? [], closed);
    if (closed && canFill) ctx.fill();
    if (canStroke) ctx.stroke();
    if (drawing.kind === "arrow") paintArrowHead(ctx, drawing.points ?? []);
  }
  ctx.restore();
}

function trace(ctx: CanvasRenderingContext2D, points: number[], closed: boolean) {
  ctx.beginPath();
  if (points.length < 2) return;
  ctx.moveTo(points[0] ?? 0, points[1] ?? 0);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
  if (closed) ctx.closePath();
}

function paintArrowHead(ctx: CanvasRenderingContext2D, points: number[]) {
  if (points.length < 4) return;
  const x2 = points[points.length - 2] ?? 0;
  const y2 = points[points.length - 1] ?? 0;
  const x1 = points[points.length - 4] ?? 0;
  const y1 = points[points.length - 3] ?? 0;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(10, ctx.lineWidth * 4);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(angle - 0.45), y2 - len * Math.sin(angle - 0.45));
  ctx.lineTo(x2 - len * Math.cos(angle + 0.45), y2 - len * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fillStyle = typeof ctx.strokeStyle === "string" ? ctx.strokeStyle : palette.ink;
  ctx.fill();
}
