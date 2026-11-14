import { useRef } from "react";
import { Shape } from "react-konva";
import type { Context } from "konva/lib/Context";
import type Konva from "konva";
import { defaultAdjustments } from "../model/document";
import type { Adjustments, ImageMask } from "../model/types";
import { paintPhoto } from "./raster";

/** Draws the original bitmap with adjustments and the vector mask. Does not modify the source image. */
export function MaskedImage({
  image,
  width,
  height,
  mask,
  adjustments,
  name = "photo",
}: {
  image: CanvasImageSource;
  width: number;
  height: number;
  mask: ImageMask | null;
  adjustments?: Adjustments;
  name?: string;
}) {
  const buffer = useRef<HTMLCanvasElement | null>(null);
  const painted = useRef("");
  const src = image instanceof HTMLImageElement ? image.src : "";
  const look = adjustments ?? defaultAdjustments();
  return (
    <Shape
      name={name}
      width={width}
      height={height}
      listening
      sceneFunc={(context: Context) => {
        if (width < 1 || height < 1) return;
        const stamp = `${src}|${width}x${height}|${JSON.stringify(mask)}|${JSON.stringify(look)}`;
        let canvas = buffer.current;
        if (!canvas || canvas.width !== Math.ceil(width) || canvas.height !== Math.ceil(height)) {
          canvas = document.createElement("canvas");
          canvas.width = Math.ceil(width);
          canvas.height = Math.ceil(height);
          buffer.current = canvas;
          painted.current = "";
        }
        if (painted.current !== stamp) {
          paintPhoto(canvas, image, canvas.width, canvas.height, look, mask);
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
