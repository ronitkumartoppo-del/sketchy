import { useEffect, useState } from "react";
import { Arrow, Ellipse, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import { bakeDrawingTransform } from "../model/geometry";
import { CurveShape } from "./CurveShape";
import type { DrawingObject } from "../model/types";

export function useHtmlImage(url: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const element = new window.Image();
    element.onload = () => setImage(element);
    element.src = url;
    return () => {
      element.onload = null;
    };
  }, [url]);
  return image;
}

export function DrawingShape({ drawing }: { drawing: DrawingObject }) {
  const opacity = drawing.opacity;
  const hit = Math.max(18, drawing.strokeWidth * 4);
  switch (drawing.kind) {
    case "rect":
      return (
        <Rect
          width={drawing.width ?? 0}
          height={drawing.height ?? 0}
          fill={drawing.fill}
          stroke={drawing.stroke}
          strokeWidth={drawing.strokeWidth}
          opacity={opacity}
          cornerRadius={2}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          x={(drawing.width ?? 0) / 2}
          y={(drawing.height ?? 0) / 2}
          radiusX={Math.max(1, (drawing.width ?? 0) / 2)}
          radiusY={Math.max(1, (drawing.height ?? 0) / 2)}
          fill={drawing.fill}
          stroke={drawing.stroke}
          strokeWidth={drawing.strokeWidth}
          opacity={opacity}
        />
      );
    case "arrow":
      return (
        <Arrow
          points={drawing.points ?? []}
          stroke={drawing.stroke}
          fill={drawing.stroke}
          strokeWidth={drawing.strokeWidth}
          pointerLength={Math.max(10, drawing.strokeWidth * 4)}
          pointerWidth={Math.max(10, drawing.strokeWidth * 4)}
          hitStrokeWidth={hit}
          opacity={opacity}
          lineCap="round"
        />
      );
    case "text":
      return (
        <Text
          text={drawing.text ?? ""}
          width={drawing.width ?? 160}
          fontSize={drawing.fontSize ?? 28}
          fontFamily="Outfit, sans-serif"
          fill={drawing.fill === "transparent" ? drawing.stroke : drawing.fill}
          opacity={opacity}
        />
      );
    case "polygon":
      return (
        <Line
          points={drawing.points ?? []}
          closed
          fill={drawing.fill}
          stroke={drawing.stroke}
          strokeWidth={drawing.strokeWidth}
          hitStrokeWidth={hit}
          opacity={opacity}
        />
      );
    case "bezier":
      return (
        <CurveShape
          points={drawing.points ?? []}
          stroke={drawing.stroke}
          strokeWidth={drawing.strokeWidth}
          opacity={opacity}
        />
      );
    default:
      return (
        <Line
          points={drawing.points ?? []}
          stroke={drawing.stroke}
          strokeWidth={drawing.strokeWidth}
          tension={drawing.kind === "freehand" ? 0.35 : 0}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={hit}
          opacity={opacity}
        />
      );
  }
}

export function DrawingNode({
  drawing,
  listening,
  onSelect,
  onCommit,
  onEdit,
}: {
  drawing: DrawingObject;
  listening: boolean;
  onSelect: (shift: boolean) => void;
  onCommit: (drawing: DrawingObject) => void;
  onEdit?: () => void;
}) {
  const draggable = listening && drawing.id !== "draft";
  const select = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    event.cancelBubble = true;
    if (!listening) return;
    const shift = "shiftKey" in event.evt && event.evt.shiftKey;
    onSelect(shift);
  };
  return (
    <Group
      id={drawing.id}
      x={drawing.x}
      y={drawing.y}
      rotation={drawing.rotation}
      draggable={draggable}
      listening={listening}
      onMouseDown={(event) => {
        event.cancelBubble = true;
      }}
      onClick={select}
      onTap={select}
      onDblClick={(event) => {
        event.cancelBubble = true;
        onEdit?.();
      }}
      onDblTap={(event) => {
        event.cancelBubble = true;
        onEdit?.();
      }}
      onDragEnd={(event) => {
        const node = event.target;
        onCommit({ ...drawing, x: node.x(), y: node.y() });
      }}
      onTransformEnd={(event) => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onCommit(
          bakeDrawingTransform(drawing, {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            scaleX,
            scaleY,
          }),
        );
      }}
    >
      <DrawingShape drawing={drawing} />
    </Group>
  );
}
