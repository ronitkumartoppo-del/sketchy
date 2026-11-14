import { useRef } from "react";
import { Shape } from "react-konva";
import type { Context } from "konva/lib/Context";
import type Konva from "konva";
import { denormalizePoints } from "../model/geometry";
import { effectiveMaskMode } from "../model/mask";
import type { ImageMask } from "../model/types";

function paintMask(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  width: number,
  height: number,
  mask: ImageMask,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(image, 0, 0, width, height);
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

/** Draws the original bitmap with the vector mask. Does not modify the source image. */
export function MaskedImage({
  image,
  width,
  height,
  mask,
  name = "photo",
}: {
  image: CanvasImageSource;
  width: number;
  height: number;
  mask: ImageMask;
  name?: string;
}) {
  const buffer = useRef<HTMLCanvasElement | null>(null);
  const painted = useRef("");
  const src = image instanceof HTMLImageElement ? image.src : "";
  return (
    <Shape
      name={name}
      width={width}
      height={height}
      listening
      sceneFunc={(context: Context) => {
        if (width < 1 || height < 1) return;
        const stamp = `${src}|${width}x${height}|${JSON.stringify(mask)}`;
        let canvas = buffer.current;
        if (!canvas || canvas.width !== Math.ceil(width) || canvas.height !== Math.ceil(height)) {
          canvas = document.createElement("canvas");
          canvas.width = Math.ceil(width);
          canvas.height = Math.ceil(height);
          buffer.current = canvas;
          painted.current = "";
        }
        if (painted.current !== stamp) {
          paintMask(canvas, image, width, height, mask);
          painted.current = stamp;
        }
        context.drawImage(canvas, 0, 0, width, height);
      }}
      hitFunc={(context: Context, shape: Konva.Shape) => {
        context.beginPath();
        context.rect(0, 0, width, height);
        context.closePath();
        context.fillStrokeShape(shape);
      }}
    />
  );
}
