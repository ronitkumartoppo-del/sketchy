import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Arrow, Ellipse, Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import { viewNeedsComposite } from "../model/adjust";
import { bakeBoardTransform } from "../model/geometry";
import { palette } from "../model/palette";
import type { Adjustments, BoardObject, DrawingObject, ImageMask } from "../model/types";
import { useSketchy } from "../store/use-sketchy";
import { DrawingShape } from "./drawings";
import { MaskedImage } from "./MaskedImage";

function useHtmlImage(url: string | undefined): HTMLImageElement | null {
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

export function BoardNode({ object, listening }: { object: BoardObject; listening: boolean }) {
  const navigate = useNavigate();
  const url = useSketchy((state) => (object.type === "image" ? state.assetUrls[object.assetId] : undefined));
  const image = useHtmlImage(url);
  const drawings = useSketchy((state) =>
    object.type === "image" ? state.history.present.imageProjects[object.imageProjectId]?.drawings : undefined,
  );
  const source = useSketchy((state) =>
    object.type === "image" ? state.history.present.assets[object.assetId] : undefined,
  );
  const mask = useSketchy((state) =>
    object.type === "image" ? (state.history.present.imageProjects[object.imageProjectId]?.mask ?? null) : null,
  );
  const adjustments = useSketchy((state) =>
    object.type === "image" ? state.history.present.imageProjects[object.imageProjectId]?.adjustments : undefined,
  );
  const draggable = listening && !object.locked && object.id !== "draft";

  const onSelect = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    event.cancelBubble = true;
    if (!listening) return;
    const store = useSketchy.getState();
    const shift = "shiftKey" in event.evt && event.evt.shiftKey;
    if (shift) store.toggleSelect(object.id);
    else store.selectOnly(object.id);
  };

  const onDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target;
    const current = useSketchy
      .getState()
      .history.present.boards.flatMap((board) => board.objects)
      .find((item) => item.id === object.id);
    if (!current) return;
    useSketchy.getState().replaceObject({ ...current, x: node.x(), y: node.y() });
  };

  const onTransformEnd = (event: Konva.KonvaEventObject<Event>) => {
    const node = event.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const current = useSketchy
      .getState()
      .history.present.boards.flatMap((board) => board.objects)
      .find((item) => item.id === object.id);
    if (!current) return;
    useSketchy.getState().replaceObject(
      bakeBoardTransform(current, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX,
        scaleY,
      }),
    );
  };

  return (
    <Group
      id={object.id}
      name="board-object"
      x={object.x}
      y={object.y}
      rotation={object.rotation}
      draggable={draggable}
      listening={listening}
      onMouseDown={(event) => {
        event.cancelBubble = true;
      }}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={(event) => openStudio(event)}
      onDblTap={(event) => openStudio(event)}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      <NodeShape
        object={object}
        image={image}
        drawings={drawings}
        mask={mask}
        adjustments={adjustments}
        sourceWidth={source?.width}
        sourceHeight={source?.height}
      />
    </Group>
  );

  function openStudio(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (object.type !== "image") return;
    event.cancelBubble = true;
    void navigate({ to: "/studio", search: { edit: object.imageProjectId } });
  }
}

function NodeShape({
  object,
  image,
  drawings,
  mask,
  adjustments,
  sourceWidth,
  sourceHeight,
}: {
  object: BoardObject;
  image: HTMLImageElement | null;
  drawings?: DrawingObject[];
  mask: ImageMask | null;
  adjustments?: Adjustments;
  sourceWidth?: number;
  sourceHeight?: number;
}) {
  switch (object.type) {
    case "rect":
      return (
        <Rect
          width={object.width}
          height={object.height}
          fill={object.fill}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
          cornerRadius={2}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          x={object.width / 2}
          y={object.height / 2}
          radiusX={Math.max(1, object.width / 2)}
          radiusY={Math.max(1, object.height / 2)}
          fill={object.fill}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
        />
      );
    case "arrow":
      return (
        <Arrow
          points={object.points}
          stroke={object.stroke}
          fill={object.stroke}
          strokeWidth={object.strokeWidth}
          pointerLength={12}
          pointerWidth={12}
          hitStrokeWidth={20}
          lineCap="round"
        />
      );
    case "pen":
      return (
        <Line
          points={object.points}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
          tension={0.35}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={20}
        />
      );
    case "text":
      return (
        <Text
          text={object.text}
          width={object.width}
          fontSize={object.fontSize}
          fontFamily="Outfit, sans-serif"
          fill={object.fill}
          lineHeight={1.25}
        />
      );
    case "note":
      return (
        <>
          <Rect width={object.width} height={object.height} fill={object.fill} cornerRadius={10} />
          <Text
            x={12}
            y={12}
            width={Math.max(12, object.width - 24)}
            height={Math.max(12, object.height - 24)}
            text={object.text}
            fontSize={16}
            fontFamily="Outfit, sans-serif"
            fill={palette.ink}
            lineHeight={1.35}
          />
        </>
      );
    case "image":
      return image ? (
        <>
          {viewNeedsComposite(adjustments, mask) ? (
            <MaskedImage
              key={`${JSON.stringify(mask)}|${JSON.stringify(adjustments)}`}
              image={image}
              width={object.width}
              height={object.height}
              mask={mask}
              adjustments={adjustments}
            />
          ) : (
            <KonvaImage image={image} width={object.width} height={object.height} />
          )}
          {drawings && drawings.length > 0 && sourceWidth && sourceHeight ? (
            <Group
              listening={false}
              scaleX={object.width / sourceWidth}
              scaleY={object.height / sourceHeight}
              clipX={0}
              clipY={0}
              clipWidth={sourceWidth}
              clipHeight={sourceHeight}
            >
              {drawings.map((drawing) => (
                <Group key={drawing.id} x={drawing.x} y={drawing.y} rotation={drawing.rotation} listening={false}>
                  <DrawingShape drawing={drawing} />
                </Group>
              ))}
            </Group>
          ) : null}
        </>
      ) : (
        <>
          <Rect width={object.width} height={object.height} fill={palette.line} />
          <Text
            x={12}
            y={12}
            width={Math.max(12, object.width - 24)}
            text={useSketchy.getState().assetUrls[object.assetId] ? "Opening image…" : "Missing image"}
            fontSize={14}
            fontFamily="Outfit, sans-serif"
            fill={palette.ink}
          />
        </>
      );
  }
}
