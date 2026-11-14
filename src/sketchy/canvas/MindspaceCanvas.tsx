import { Download, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Layer, Rect, Shape, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { toast } from "sonner";
import { activeBoard } from "../model/document";
import { screenToWorld, rootObjects, worldOrigin, zoomAt, zoomBy, type Point } from "../model/geometry";
import { curvePoints } from "../model/curve";
import { FRAME_PRESETS } from "../model/frames";
import { PICTURE_FILES } from "../model/export";
import { createId } from "../model/ids";
import { addObject } from "../model/ops";
import { DEFAULT_STROKE_WIDTH, palette } from "../model/palette";
import type { BoardObject, Camera, FrameObject, Tool } from "../model/types";
import { useSketchy } from "../store/use-sketchy";
import { SelectionBar } from "../ui/SelectionBar";
import { ToolRail } from "../ui/ToolRail";
import { BoardNode } from "./BoardNodes";
import { importImageFiles, viewSize } from "./import-image";

type Drag =
  | { mode: "pan"; startScreen: Point; startCamera: Camera }
  | { mode: "draw"; origin: Point; tool: Tool };

const cameraRef = { current: { x: 48, y: 48, scale: 1 } as Camera };
const spaceRef = { current: false };
const pinchRef = { current: false };
const dragRef = { current: null as Drag | null };
const draftRef = { current: null as BoardObject | null };
const editingSink = { current: null as ((id: string | null) => void) | null };
const framePresetRef = { current: FRAME_PRESETS[0] as (typeof FRAME_PRESETS)[number] };

function setEditingId(id: string | null) {
  editingSink.current?.(id);
}

function publishCamera(camera: Camera) {
  cameraRef.current = camera;
  useSketchy.getState().setBoardCamera(camera);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function isEmptyTarget(target: Konva.Node, stage: Konva.Stage): boolean {
  return target === stage || target.name() === "paper" || target.name() === "grid";
}

export function MindspaceCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [space, setSpace] = useState(false);
  const [draft, setDraft] = useState<BoardObject | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const cancelEdit = useRef(false);

  const ready = useSketchy((state) => state.ready);
  const project = useSketchy((state) => state.history.present);
  const tool = useSketchy((state) => state.tool);
  const linkFrom = useSketchy((state) => state.linkFrom);
  const selection = useSketchy((state) => state.selection);
  const board = activeBoard(project);
  cameraRef.current = board.camera;
  editingSink.current = setEditingId;
  viewSize.width = size.width;
  viewSize.height = size.height;

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setSize({ width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (pinchRef.current) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const next = zoomAt(
        cameraRef.current,
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        event.deltaY,
      );
      publishCamera(next);
    };
    const pointers = new Map<number, Point>();
    let lastDistance = 0;
    let lastCenter = { x: 0, y: 0 };
    const remember = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    const onPointerDown = (event: PointerEvent) => {
      remember(event);
      if (pointers.size === 2) {
        pinchRef.current = true;
        dragRef.current = null;
        draftRef.current = null;
        setDraft(null);
        const [a, b] = [...pointers.values()];
        lastDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        lastCenter = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      remember(event);
      if (pointers.size !== 2 || lastDistance <= 0) return;
      event.preventDefault();
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const center = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
      const zoomed = zoomBy(cameraRef.current, center, distance / lastDistance);
      publishCamera({
        ...zoomed,
        x: zoomed.x + (center.x - lastCenter.x),
        y: zoomed.y + (center.y - lastCenter.y),
      });
      lastDistance = distance;
      lastCenter = center;
    };
    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchRef.current = false;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove, { passive: false });
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
    };
  }, [ready]);

  useEffect(() => {
    const finish = () => finishDraw(setDraft, setEditingId);
    window.addEventListener("pointerup", finish);
    return () => window.removeEventListener("pointerup", finish);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTypingTarget(event.target)) {
        if (event.type === "keydown") {
          event.preventDefault();
          spaceRef.current = true;
          setSpace(true);
        } else {
          spaceRef.current = false;
          setSpace(false);
        }
        return;
      }
      if (event.type !== "keydown" || isTypingTarget(event.target)) return;
      const store = useSketchy.getState();
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        store.redo();
        return;
      }
      if (mod && key === "d") {
        event.preventDefault();
        store.duplicate();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        store.removeSelection();
        return;
      }
      if (event.key === "Escape") {
        store.selectOnly(null);
        store.pickLink(null);
        setEditingId(null);
        return;
      }
      if (!mod && key === "g") {
        event.preventDefault();
        if (event.shiftKey) store.ungroupSelection();
        else store.groupSelection();
        return;
      }
      if (mod || event.altKey) return;
      const tools: Record<string, Tool> = {
        v: "select",
        h: "pan",
        p: "pen",
        b: "curve",
        r: "rect",
        o: "ellipse",
        a: "arrow",
        t: "text",
        n: "note",
        l: "link",
        f: "frame",
      };
      const next = tools[key];
      if (next) {
        event.preventDefault();
        store.setTool(next);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const files: File[] = [];
      for (const item of event.clipboardData?.items ?? []) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length === 0) return;
      event.preventDefault();
      void importImageFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    if (tool !== "select") {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }
    const nodes = selection
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => {
        if (!node) return false;
        const object = board.objects.find((item) => item.id === node.id());
        return Boolean(object && !object.locked && object.type !== "connector");
      });
    const onlyImage = nodes.length === 1 && board.objects.some((object) => object.id === nodes[0]!.id() && object.type === "image");
    transformer.nodes(nodes);
    transformer.keepRatio(onlyImage);
    transformer.getLayer()?.batchDraw();
  }, [selection, board.objects, tool, size.width, size.height]);

  const editing = board.objects.find((object) => object.id === editingId);
  const cursor = space || tool === "pan" ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair";

  if (!ready) {
    return <p className="grid h-full place-items-center text-sm text-muted">Restoring this browser session…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col-reverse md:flex-row">
      <ToolRail />
      <div
        ref={hostRef}
        className={"relative min-h-0 min-w-0 flex-1 touch-none " + cursor}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void importImageFiles([...event.dataTransfer.files]);
        }}
      >
        {size.width > 0 && (
          <Stage
            ref={stageRef}
            width={size.width}
            height={size.height}
            x={board.camera.x}
            y={board.camera.y}
            scaleX={board.camera.scale}
            scaleY={board.camera.scale}
            onMouseDown={(event) => onStageDown(event, setDraft)}
            onMouseMove={(event) => onStageMove(event, setDraft)}
            onTouchStart={(event) => onStageDown(event, setDraft)}
            onTouchMove={(event) => onStageMove(event, setDraft)}
          >
            <Layer>
              <Rect name="paper" x={-20000} y={-20000} width={40000} height={40000} fill={palette.paper} />
              <DotGrid width={size.width} height={size.height} camera={board.camera} />
              {rootObjects(board.objects).map((object) => (
                <BoardNode key={object.id} object={object} listening={tool === "select" || tool === "link"} />
              ))}
              {draft ? <BoardNode object={draft} listening={false} /> : null}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                borderStroke={palette.accent}
                anchorStroke={palette.accent}
                anchorFill={palette.surface}
                anchorSize={8}
                padding={2}
              />
            </Layer>
          </Stage>
        )}
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[70%] flex-wrap gap-1">
          {project.boards.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => useSketchy.getState().switchBoard(item.id)}
              className={
                "pointer-events-auto max-w-32 truncate rounded-full px-3 py-2 text-xs font-medium " +
                (item.id === project.activeBoardId ? "bg-ink text-paper" : "bg-surface text-muted")
              }
            >
              {item.name}
            </button>
          ))}
          <button
            type="button"
            aria-label="Add board"
            onClick={() => useSketchy.getState().newBoard()}
            className="pointer-events-auto grid size-9 place-items-center rounded-full bg-surface text-ink"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <button
          type="button"
          className="absolute right-3 top-3 rounded-full bg-surface px-3 py-2 text-xs font-medium text-ink"
          onClick={() => downloadView(stageRef.current)}
        >
          <span className="inline-flex items-center gap-1">
            <Download className="size-4" />
            View PNG
          </span>
        </button>
        <button
          type="button"
          className="absolute bottom-20 left-3 rounded-full bg-surface px-3 py-2 text-xs text-muted md:bottom-3"
          onClick={() => publishCamera({ x: 48, y: 48, scale: 1 })}
        >
          {Math.round(board.camera.scale * 100)}%
        </button>
        {board.objects.length === 0 && !draft ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
            <div>
              <p className="font-display text-3xl italic">This board is empty.</p>
              <p className="mt-2 max-w-sm text-sm text-muted">
                Drop an image, paste a screenshot, or pick a tool. F adds a frame, L connects, G groups.
              </p>
            </div>
          </div>
        ) : null}
        {tool === "link" ? (
          <p className="pointer-events-none absolute left-3 top-14 rounded-full bg-surface px-3 py-2 text-xs text-ink">
            {linkFrom ? "Click the second object." : "Click the first object. Escape cancels."}
          </p>
        ) : null}
        {tool === "frame" ? (
          <div className="absolute bottom-20 left-3 flex gap-1 md:bottom-14">
            {FRAME_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  "rounded-full px-3 py-2 text-xs font-medium " +
                  (framePresetRef.current.id === item.id ? "bg-ink text-paper" : "bg-surface text-muted")
                }
                onClick={() => {
                  framePresetRef.current = item;
                  const world = screenToWorld(cameraRef.current, {
                    x: viewSize.width / 2,
                    y: viewSize.height / 2,
                  });
                  placeFrame(world);
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        ) : null}
        {editing && (editing.type === "text" || editing.type === "note") ? (
          <textarea
            autoFocus
            defaultValue={editing.text}
            key={editing.id}
            className="absolute z-30 resize-none rounded-md bg-surface/90 p-1 text-ink outline-none"
            style={{
              left: (worldOrigin(board.objects, editing.id)?.x ?? editing.x) * board.camera.scale + board.camera.x,
              top:
                ((worldOrigin(board.objects, editing.id)?.y ?? editing.y) + (editing.type === "note" ? 12 : 0)) *
                  board.camera.scale +
                board.camera.y,
              width: Math.max(80, editing.width * board.camera.scale),
              height: editing.type === "note" ? Math.max(60, (editing.height - 16) * board.camera.scale) : undefined,
              fontSize: (editing.type === "text" ? editing.fontSize : 16) * board.camera.scale,
              fontFamily: "Outfit, sans-serif",
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelEdit.current = true;
                setEditingId(null);
              }
            }}
            onBlur={(event) => {
              if (cancelEdit.current) {
                cancelEdit.current = false;
                return;
              }
              const current = activeBoard(useSketchy.getState().history.present).objects.find(
                (object) => object.id === editing.id,
              );
              if (!current || (current.type !== "text" && current.type !== "note")) return;
              if (current.text === event.target.value) return;
              useSketchy.getState().replaceObject({ ...current, text: event.target.value });
            }}
          />
        ) : null}
        <SelectionBar />
      </div>
    </div>
  );
}

function placeFrame(world: Point) {
  const preset = framePresetRef.current;
  const frame: FrameObject = {
    id: createId("obj"),
    type: "frame",
    name: preset.name,
    x: world.x - preset.width / 2,
    y: world.y - preset.height / 2,
    rotation: 0,
    locked: false,
    width: preset.width,
    height: preset.height,
    fill: palette.surface,
    childIds: [],
  };
  const store = useSketchy.getState();
  store.commit((project) => addObject(project, frame));
  store.setTool("select");
  store.selectOnly(frame.id);
}

function updateDraft(next: BoardObject | null, setDraft: (value: BoardObject | null) => void) {
  draftRef.current = next;
  setDraft(next);
}

function onStageDown(
  event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  setDraft: (value: BoardObject | null) => void,
) {
  if (pinchRef.current) return;
  const stage = event.target.getStage();
  if (!stage) return;
  const pointer = stage.getPointerPosition();
  if (!pointer) return;
  const store = useSketchy.getState();
  const middle = "button" in event.evt && event.evt.button === 1;
  if (store.tool === "pan" || spaceRef.current || middle) {
    dragRef.current = { mode: "pan", startScreen: pointer, startCamera: cameraRef.current };
    return;
  }
  if (store.tool === "link") {
    if (isEmptyTarget(event.target, stage)) store.pickLink(null);
    return;
  }
  if (store.tool === "frame") {
    placeFrame(screenToWorld(cameraRef.current, pointer));
    return;
  }
  if (store.tool === "select") {
    if (isEmptyTarget(event.target, stage)) store.selectOnly(null);
    return;
  }
  if (!isEmptyTarget(event.target, stage)) return;
  const world = screenToWorld(cameraRef.current, pointer);
  if (store.tool === "text" || store.tool === "note") {
    placeLabel(store.tool, world, setEditingId);
    return;
  }
  dragRef.current = { mode: "draw", origin: world, tool: store.tool };
  updateDraft(initialDraft(store.tool, world, store.stroke, store.fill), setDraft);
}

function onStageMove(
  event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  setDraft: (value: BoardObject | null) => void,
) {
  const drag = dragRef.current;
  if (!drag || pinchRef.current) return;
  const pointer = event.target.getStage()?.getPointerPosition();
  if (!pointer) return;
  if (drag.mode === "pan") {
    publishCamera({
      ...drag.startCamera,
      x: drag.startCamera.x + (pointer.x - drag.startScreen.x),
      y: drag.startCamera.y + (pointer.y - drag.startScreen.y),
    });
    return;
  }
  const world = screenToWorld(cameraRef.current, pointer);
  const { stroke, fill } = useSketchy.getState();
  if (drag.tool === "pen") {
    const current = draftRef.current;
    if (!current || current.type !== "pen") return;
    const lastX = current.points[current.points.length - 2] ?? 0;
    const lastY = current.points[current.points.length - 1] ?? 0;
    const nextX = world.x - drag.origin.x;
    const nextY = world.y - drag.origin.y;
    if (Math.hypot(nextX - lastX, nextY - lastY) < 1.4) return;
    updateDraft({ ...current, points: [...current.points, nextX, nextY] }, setDraft);
    return;
  }
  updateDraft(resizeDraft(drag.origin, drag.tool, world, stroke, fill), setDraft);
}

function finishDraw(
  setDraftState: (value: BoardObject | null) => void,
  setEditing: (id: string | null) => void,
) {
  const drag = dragRef.current;
  dragRef.current = null;
  if (!drag || drag.mode !== "draw") return;
  const draft = draftRef.current;
  draftRef.current = null;
  setDraftState(null);
  if (!draft || !isDrawable(draft)) return;
  const object = { ...draft, id: createId("obj") };
  useSketchy.getState().commit((project) => addObject(project, object));
  useSketchy.getState().setTool("select");
  useSketchy.getState().selectOnly(object.id);
  if (object.type === "text" || object.type === "note") setEditing(object.id);
}

function placeLabel(tool: "text" | "note", world: Point, setEditing: (id: string | null) => void) {
  const { fill } = useSketchy.getState();
  const object: BoardObject =
    tool === "text"
      ? {
          id: createId("obj"),
          type: "text",
          x: world.x,
          y: world.y,
          rotation: 0,
          locked: false,
          width: 220,
          text: "Text",
          fontSize: 28,
          fill: fill === "transparent" ? palette.ink : fill,
        }
      : {
          id: createId("obj"),
          type: "note",
          x: world.x,
          y: world.y,
          rotation: 0,
          locked: false,
          width: 200,
          height: 150,
          text: "Note",
          fill: palette.note,
        };
  useSketchy.getState().commit((project) => addObject(project, object));
  useSketchy.getState().setTool("select");
  useSketchy.getState().selectOnly(object.id);
  setEditing(object.id);
}

function initialDraft(tool: Tool, origin: Point, stroke: string, fill: string): BoardObject {
  const base = { id: "draft", x: origin.x, y: origin.y, rotation: 0, locked: false };
  if (tool === "arrow") {
    return { ...base, type: "arrow", points: [0, 0, 0, 0], stroke, strokeWidth: DEFAULT_STROKE_WIDTH };
  }
  if (tool === "curve") {
    return { ...base, type: "curve", points: curvePoints({ x: 0, y: 0 }), stroke, strokeWidth: DEFAULT_STROKE_WIDTH };
  }
  if (tool === "pen") {
    return { ...base, type: "pen", points: [0, 0], stroke, strokeWidth: DEFAULT_STROKE_WIDTH };
  }
  if (tool === "ellipse") {
    return { ...base, type: "ellipse", width: 0, height: 0, fill, stroke, strokeWidth: DEFAULT_STROKE_WIDTH };
  }
  return { ...base, type: "rect", width: 0, height: 0, fill, stroke, strokeWidth: DEFAULT_STROKE_WIDTH };
}

function resizeDraft(origin: Point, tool: Tool, world: Point, stroke: string, fill: string): BoardObject {
  const x = Math.min(origin.x, world.x);
  const y = Math.min(origin.y, world.y);
  const width = Math.abs(world.x - origin.x);
  const height = Math.abs(world.y - origin.y);
  if (tool === "arrow") {
    return {
      id: "draft",
      type: "arrow",
      x: origin.x,
      y: origin.y,
      rotation: 0,
      locked: false,
      points: [0, 0, world.x - origin.x, world.y - origin.y],
      stroke,
      strokeWidth: DEFAULT_STROKE_WIDTH,
    };
  }
  if (tool === "curve") {
    return {
      id: "draft",
      type: "curve",
      x: origin.x,
      y: origin.y,
      rotation: 0,
      locked: false,
      points: curvePoints({ x: world.x - origin.x, y: world.y - origin.y }),
      stroke,
      strokeWidth: DEFAULT_STROKE_WIDTH,
    };
  }
  if (tool === "ellipse") {
    return {
      id: "draft",
      type: "ellipse",
      x,
      y,
      rotation: 0,
      locked: false,
      width,
      height,
      fill,
      stroke,
      strokeWidth: DEFAULT_STROKE_WIDTH,
    };
  }
  return {
    id: "draft",
    type: "rect",
    x,
    y,
    rotation: 0,
    locked: false,
    width,
    height,
    fill,
    stroke,
    strokeWidth: DEFAULT_STROKE_WIDTH,
  };
}

function isDrawable(object: BoardObject): boolean {
  if (object.type === "rect" || object.type === "ellipse") return object.width >= 4 || object.height >= 4;
  if (object.type === "pen" || object.type === "arrow" || object.type === "curve") {
    const pts = object.points;
    const dx = (pts[pts.length - 2] ?? 0) - (pts[0] ?? 0);
    const dy = (pts[pts.length - 1] ?? 0) - (pts[1] ?? 0);
    return Math.hypot(dx, dy) >= 3 || pts.length > 6;
  }
  return true;
}

function downloadView(stage: Konva.Stage | null) {
  if (!stage) return;
  const grid = stage.findOne(".grid");
  grid?.hide();
  const url = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
  grid?.show();
  stage.batchDraw();
  const link = document.createElement("a");
  link.href = url;
  link.download = PICTURE_FILES.view;
  link.click();
  toast.success("Downloaded a PNG of this view. It is not the editable project.");
}

function DotGrid({ width, height, camera }: { width: number; height: number; camera: Camera }) {
  return (
    <Shape
      name="grid"
      listening={false}
      width={width}
      height={height}
      sceneFunc={(context) => {
        const gap = camera.scale < 0.45 ? 112 : 28;
        const left = (0 - camera.x) / camera.scale;
        const top = (0 - camera.y) / camera.scale;
        const right = (width - camera.x) / camera.scale;
        const bottom = (height - camera.y) / camera.scale;
        const dot = 1.3 / camera.scale;
        context.fillStyle = palette.dot;
        context.beginPath();
        for (let x = Math.floor(left / gap) * gap; x < right; x += gap) {
          for (let y = Math.floor(top / gap) * gap; y < bottom; y += gap) {
            context.rect(x, y, dot, dot);
          }
        }
        context.fill();
      }}
    />
  );
}
