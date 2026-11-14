import { compareStage, clampFade, type CompareLayout, type CompareView } from "../model/compare";
import { palette } from "../model/palette";
import type { Adjustments, DrawingObject, ImageMask } from "../model/types";
import { paintPhoto } from "./raster";

export interface SourcePaint {
  image: CanvasImageSource | null;
  width: number;
  height: number;
  mask: ImageMask | null;
  drawings: DrawingObject[];
  adjustments: Adjustments;
}

const LABEL_BAND = 40;

/** Raster of one picture. Original skips adjustments, the mask, and the drawings. Does not touch the source image. */
export function renderSource(source: SourcePaint, view: CompareView): HTMLCanvasElement {
  const width = Math.max(1, Math.round(source.width));
  const height = Math.max(1, Math.round(source.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  if (!source.image) {
    ctx.fillStyle = palette.line;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = palette.ink;
    ctx.font = "16px Outfit, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Missing image", 16, 16);
    return canvas;
  }
  ctx.drawImage(source.image, 0, 0, width, height);
  if (view === "edited") {
    paintPhoto(canvas, source.image, width, height, source.adjustments, source.mask);
    if (source.drawings.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      for (const drawing of source.drawings) paintDrawing(ctx, drawing);
      ctx.restore();
    }
  }
  return canvas;
}

function paintDrawing(ctx: CanvasRenderingContext2D, drawing: DrawingObject) {
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

function fitLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1);
  return `${next}…`;
}

/** Picture of the comparison. Not a project file. */
export function renderComparison(options: {
  a: HTMLCanvasElement;
  b: HTMLCanvasElement;
  layout: CompareLayout;
  fade: number;
  labelA: string;
  labelB: string;
  width: number;
  height: number;
}): HTMLCanvasElement {
  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(LABEL_BAND + 1, Math.floor(options.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, width, height);
  const pictureH = height - LABEL_BAND;
  const stage = compareStage(options.a.width, options.a.height, options.b.width, options.b.height, options.layout, width, pictureH, 20);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (options.layout === "overlay") {
    ctx.drawImage(options.a, stage.a.x, stage.a.y, stage.a.w, stage.a.h);
    ctx.save();
    ctx.globalAlpha = clampFade(options.fade);
    ctx.drawImage(options.b, stage.b.x, stage.b.y, stage.b.w, stage.b.h);
    ctx.restore();
  } else {
    ctx.drawImage(options.a, stage.a.x, stage.a.y, stage.a.w, stage.a.h);
    ctx.drawImage(options.b, stage.b.x, stage.b.y, stage.b.w, stage.b.h);
    ctx.fillStyle = palette.line;
    ctx.fillRect(Math.round(width / 2) - 1, 0, 2, pictureH);
  }
  const fontSize = Math.max(13, Math.round(Math.min(width, height) / 48));
  ctx.font = `500 ${fontSize}px Outfit, sans-serif`;
  ctx.fillStyle = palette.ink;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const labelY = pictureH + LABEL_BAND / 2;
  if (options.layout === "side") {
    const col = width / 2 - 16;
    ctx.fillText(fitLabel(ctx, options.labelA, col), width * 0.25, labelY);
    ctx.fillText(fitLabel(ctx, options.labelB, col), width * 0.75, labelY);
  } else {
    const fade = Math.round(clampFade(options.fade) * 100);
    ctx.fillText(fitLabel(ctx, `${options.labelA}  →  ${options.labelB}  ${fade}%`, width - 24), width / 2, labelY);
  }
  return canvas;
}
