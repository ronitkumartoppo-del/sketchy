import { compareStage, clampFade, type CompareLayout, type CompareView } from "../model/compare";
import { palette } from "../model/palette";
import type { Adjustments, DrawingObject, ImageMask } from "../model/types";
import { paintDrawing, paintPhoto } from "./raster";

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
