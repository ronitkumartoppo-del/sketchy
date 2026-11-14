import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Arrow, Ellipse, Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import { viewNeedsComposite } from "../model/adjust";
import { activeBoard } from "../model/document";
import { worldCenter } from "../model/geometry";
import { moveObject, transformOwned } from "../model/ops";
import { palette } from "../model/palette";
import type { Adjustments, BoardObject, DrawingObject, FrameObject, GroupObject, ImageMask } from "../model/types";
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
  const objects = useSketchy((state) => activeBoard(state.history.present).objects);
  const draggable = listening && !object.locked && object.id !== "draft" && object.type !== "connector";

  const onSelect = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    event.cancelBubble = true;
    if (!listening) return;
    const store = useSketchy.getState();
    if (store.tool === "link") {
      store.pickLink(object.id);
      return;
    }
    const shift = "shiftKey" in event.evt && event.evt.shiftKey;
    if (shift) store.toggleSelect(object.id);
    else store.selectOnly(object.id);
  };

  const onDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    if (event.target !== event.currentTarget) return;
    const node = event.target;
    useSketchy.getState().commit((project) => moveObject(project, object.id, node.x(), node.y()));
  };

  const onTransformEnd = (event: Konva.KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    if (event.target !== event.currentTarget) return;
    const node = event.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    useSketchy.getState().commit((project) =>
      transformOwned(project, object.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX,
        scaleY,
      }),
    );
  };

  if (object.type === "connector") {
    const from = worldCenter(objects, object.fromId);
    const to = worldCenter(objects, object.toId);
    if (!from || !to) return null;
    return (
      <Group
        id={object.id}
        name="board-object"
        listening={listening}
        draggable={false}
        onMouseDown={(event) => {
          event.cancelBubble = true;
        }}
        onClick={onSelect}
        onTap={onSelect}
      >
        <Arrow
          points={[from.x, from.y, to.x, to.y]}
          stroke={object.stroke}
          fill={object.stroke}
          strokeWidth={object.strokeWidth}
          pointerLength={14}
          pointerWidth={14}
          hitStrokeWidth={18}
          lineCap="round"
        />
      </Group>
    );
  }

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
      {object.type === "group" || object.type === "frame" ? (
        <OwnedBody object={object} listening={listening} objects={objects} />
      ) : (
        <NodeShape
          object={object}
          image={image}
          drawings={drawings}
          mask={mask}
          adjustments={adjustments}
          sourceWidth={source?.width}
          sourceHeight={source?.height}
        />
      )}
    </Group>
  );

  function openStudio(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (object.type !== "image") return;
    event.cancelBubble = true;
    void navigate({ to: "/studio", search: { edit: object.imageProjectId } });
  }
}

function OwnedBody({
  object,
  listening,
  objects,
}: {
  object: GroupObject | FrameObject;
  listening: boolean;
  objects: BoardObject[];
}) {
  const children = object.childIds
    .map((id) => objects.find((item) => item.id === id))
    .filter((item): item is BoardObject => Boolean(item));
  const body = (
    <>
      {object.type === "frame" ? (
        <Rect width={object.width} height={object.height} fill={object.fill} stroke={palette.line} strokeWidth={1} />
      ) : (
        <Rect
          width={object.width}
          height={object.height}
          fill="rgba(0,0,0,0.01)"
          stroke={palette.muted}
          strokeWidth={1}
          dash={[8, 6]}
        />
      )}
      {children.map((child) => (
        <BoardNode key={child.id} object={child} listening={listening} />
      ))}
    </>
  );
  if (object.type !== "frame") return body;
  return (
    <>
      <Text
        x={0}
        y={-22}
        text={object.name}
        fontSize={16}
        fontFamily="Fraunces, Georgia, serif"
        fontStyle="italic"
        fill={palette.ink}
        listening={false}
      />
      <Group clipX={0} clipY={0} clipWidth={object.width} clipHeight={object.height}>
        {body}
      </Group>
    </>
  );
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
    case "group":
    case "frame":
    case "connector":
      return null;
  }
}
