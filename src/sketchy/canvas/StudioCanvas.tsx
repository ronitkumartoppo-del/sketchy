import { Copy, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { screenToWorld, zoomAt, zoomBy, type Point } from "../model/geometry";
import { createId } from "../model/ids";
import { addDrawing, duplicateDrawings, removeDrawings, recolorDrawings, replaceDrawing } from "../model/ops";
import { DEFAULT_STROKE_WIDTH, SWATCHES, palette } from "../model/palette";
import type { Camera, DrawingObject, Tool } from "../model/types";
import { useSketchy } from "../store/use-sketchy";
import { IconButton } from "../ui/IconButton";
import { StudioRail } from "../ui/StudioRail";
import { DrawingNode, useHtmlImage } from "./drawings";

type Drag =
  | { mode: "pan"; startScreen: Point; startCamera: Camera }
  | { mode: "draw"; origin: Point; tool: Tool };

const cameraRef = { current: { x: 0, y: 0, scale: 1 } as Camera };
const spaceRef = { current: false };
const pinchRef = { current: false };
const dragRef = { current: null as Drag | null };
const draftRef = { current: null as DrawingObject | null };
const editIdRef = { current: "" };

const DRAW_TOOLS = new Set<Tool>(["pen", "rect", "ellipse", "arrow", "text"]);

export function StudioCanvas({ editId }: { editId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const [space, setSpace] = useState(false);
  const [draft, setDraft] = useState<DrawingObject | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const cancelEdit = useRef(false);
  const fitted = useRef("");

  const ready = useSketchy((state) => state.ready);
  const project = useSketchy((state) => state.history.present);
  const tool = useSketchy((state) => state.tool);
  const stroke = useSketchy((state) => state.stroke);
  const fill = useSketchy((state) => state.fill);
  const colorTarget = useSketchy((state) => state.colorTarget);
  const edit = project.imageProjects[editId];
  const asset = edit ? project.assets[edit.assetId] : undefined;
  const url = useSketchy((state) => (edit ? state.assetUrls[edit.assetId] : undefined));
  const image = useHtmlImage(url);
  const drawings = edit?.drawings ?? [];
  editIdRef.current = editId;
  bindStudioSelection(selected, setCamera);
  if (camera) cameraRef.current = camera;

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
    if (!asset || size.width < 2) return;
    const key = `${editId}:${size.width}x${size.height}:${asset.width}x${asset.height}`;
    if (fitted.current === key) return;
    fitted.current = key;
    const scale = Math.min(size.width / asset.width, size.height / asset.height) * 0.88;
    const next = {
      scale,
      x: (size.width - asset.width * scale) / 2,
      y: (size.height - asset.height * scale) / 2,
    };
    cameraRef.current = next;
    setCamera(next);
  }, [asset, editId, size.height, size.width]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (pinchRef.current) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      publish({
        ...zoomAt(cameraRef.current, { x: event.clientX - rect.left, y: event.clientY - rect.top }, event.deltaY),
      });
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
      if (pointers.size !== 2) return;
      pinchRef.current = true;
      dragRef.current = null;
      draftRef.current = null;
      setDraft(null);
      const [a, b] = [...pointers.values()];
      lastDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      lastCenter = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
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
      publish({ ...zoomed, x: zoomed.x + (center.x - lastCenter.x), y: zoomed.y + (center.y - lastCenter.y) });
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
    const finish = () => finishDraw(setDraft, setSelected, setEditingId);
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
        duplicateSelected(setSelected);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected(setSelected);
        return;
      }
      if (event.key === "Escape") {
        setSelected([]);
        setEditingId(null);
        return;
      }
      if (mod || event.altKey) return;
      const tools: Partial<Record<string, Tool>> = {
        v: "select",
        h: "pan",
        p: "pen",
        r: "rect",
        o: "ellipse",
        a: "arrow",
        t: "text",
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
    setSelected((ids) => ids.filter((id) => drawings.some((drawing) => drawing.id === id)));
  }, [drawings]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    if (tool !== "select") {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }
    const nodes = selected
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selected, drawings, tool, size.width, size.height, camera]);

  const editing = drawings.find((drawing) => drawing.id === editingId);
  const activeTool: Tool = DRAW_TOOLS.has(tool) || tool === "select" || tool === "pan" ? tool : "select";
  const cursor = space || activeTool === "pan" ? "cursor-grab" : activeTool === "select" ? "cursor-default" : "cursor-crosshair";

  if (!ready) {
    return <p className="grid h-full place-items-center text-sm text-muted">Restoring this browser session…</p>;
  }
  if (!edit || !asset) {
    return (
      <p className="grid h-full place-items-center px-6 text-center text-sm text-muted">
        That image is not in this session.
      </p>
    );
  }

  const metrics = markMetrics(asset.width, asset.height);

  return (
    <div className="flex h-full min-h-0 flex-col-reverse md:flex-row">
      <StudioRail />
      <div ref={hostRef} className={"relative min-h-0 min-w-0 flex-1 touch-none " + cursor}>
        {size.width > 0 && camera && (
          <Stage
            ref={stageRef}
            width={size.width}
            height={size.height}
            x={camera.x}
            y={camera.y}
            scaleX={camera.scale}
            scaleY={camera.scale}
            onMouseDown={(event) => onStageDown(event, metrics, setDraft, setSelected, setEditingId)}
            onMouseMove={(event) => onStageMove(event, metrics, setDraft)}
            onTouchStart={(event) => onStageDown(event, metrics, setDraft, setSelected, setEditingId)}
            onTouchMove={(event) => onStageMove(event, metrics, setDraft)}
          >
            <Layer>
              <Rect name="paper" x={-200000} y={-200000} width={400000} height={400000} fill={palette.paper} />
              {image ? (
                <KonvaImage name="photo" image={image} width={asset.width} height={asset.height} />
              ) : (
                <Rect name="photo" width={asset.width} height={asset.height} fill={palette.line} />
              )}
              {drawings.map((drawing) => (
                <DrawingNode
                  key={drawing.id}
                  drawing={drawing}
                  listening={activeTool === "select"}
                  onSelect={(shift) => {
                    setSelected((current) =>
                      shift ? (current.includes(drawing.id) ? current.filter((id) => id !== drawing.id) : [...current, drawing.id]) : [drawing.id],
                    );
                  }}
                  onCommit={(next) => {
                    useSketchy.getState().commit((project) => replaceDrawing(project, editIdRef.current, next));
                  }}
                  onEdit={() => {
                    if (drawing.kind === "text") setEditingId(drawing.id);
                  }}
                />
              ))}
              {draft ? (
                <DrawingNode drawing={draft} listening={false} onSelect={() => undefined} onCommit={() => undefined} />
              ) : null}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                borderStroke={palette.accent}
                anchorStroke={palette.accent}
                anchorFill={palette.surface}
                anchorSize={Math.max(8, 14 / camera.scale)}
                padding={2}
              />
            </Layer>
          </Stage>
        )}
        <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-2xl bg-surface/90 px-3 py-2">
          <p className="truncate text-sm font-medium">{asset.name ?? "Image"}</p>
          <p className="text-xs text-muted">
            {drawings.length} {drawings.length === 1 ? "drawing" : "drawings"}. Original file unchanged.
          </p>
        </div>
        <button
          type="button"
          className="absolute right-3 top-3 rounded-full bg-surface px-3 py-2 text-xs text-muted"
          onClick={() => {
            if (!asset) return;
            fitted.current = "";
            const scale = Math.min(size.width / asset.width, size.height / asset.height) * 0.88;
            publish({
              scale,
              x: (size.width - asset.width * scale) / 2,
              y: (size.height - asset.height * scale) / 2,
            });
            fitted.current = `${editId}:${size.width}x${size.height}:${asset.width}x${asset.height}`;
          }}
        >
          {camera ? `${Math.round(camera.scale * 100)}%` : "Fit"}
        </button>
        <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center justify-center gap-2">
          <div className="flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-line bg-surface px-2 py-1 shadow-sm">
            <div className="flex rounded-full bg-paper p-0.5 text-xs">
              <button
                type="button"
                className={"rounded-full px-2 py-1 " + (colorTarget === "stroke" ? "bg-ink text-paper" : "text-muted")}
                onClick={() => useSketchy.getState().setColorTarget("stroke")}
              >
                Stroke
              </button>
              <button
                type="button"
                className={"rounded-full px-2 py-1 " + (colorTarget === "fill" ? "bg-ink text-paper" : "text-muted")}
                onClick={() => useSketchy.getState().setColorTarget("fill")}
              >
                Fill
              </button>
            </div>
            {SWATCHES.map((swatch) => (
              <button
                key={swatch.id}
                type="button"
                aria-label={swatch.label}
                title={swatch.label}
                onClick={() => paintDrawings(swatch.value, selected)}
                className="grid size-8 place-items-center rounded-full border border-line"
                style={{
                  background:
                    swatch.value === "transparent"
                      ? "repeating-linear-gradient(135deg, #fffdf8, #fffdf8 3px, #e3d9c8 3px, #e3d9c8 5px)"
                      : swatch.value,
                }}
              />
            ))}
            <IconButton label="Duplicate" side="top" disabled={selected.length === 0} onClick={() => duplicateSelected(setSelected)}>
              <Copy className="size-5" />
            </IconButton>
            <IconButton label="Delete" side="top" disabled={selected.length === 0} onClick={() => deleteSelected(setSelected)}>
              <Trash2 className="size-5" />
            </IconButton>
          </div>
        </div>
        {editing ? (
          <textarea
            autoFocus
            key={editing.id}
            defaultValue={editing.text ?? ""}
            className="absolute z-30 resize-none rounded-md bg-surface/90 p-1 text-ink outline-none"
            style={{
              left: editing.x * (camera?.scale ?? 1) + (camera?.x ?? 0),
              top: editing.y * (camera?.scale ?? 1) + (camera?.y ?? 0),
              width: Math.max(80, (editing.width ?? 160) * (camera?.scale ?? 1)),
              fontSize: (editing.fontSize ?? 28) * (camera?.scale ?? 1),
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
              const current = useSketchy
                .getState()
                .history.present.imageProjects[editId]?.drawings.find((drawing) => drawing.id === editing.id);
              if (!current || current.text === event.target.value) return;
              useSketchy.getState().commit((doc) => replaceDrawing(doc, editId, { ...current, text: event.target.value }));
            }}
          />
        ) : null}
        {!image && url ? (
          <p className="pointer-events-none absolute left-3 top-16 text-xs text-muted">Opening image…</p>
        ) : null}
        {!url ? (
          <p className="pointer-events-none absolute left-3 top-16 text-xs text-muted">
            The original file is missing from this browser. Drawings are still stored.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function publish(camera: Camera) {
  cameraRef.current = camera;
  cameraSink.current?.(camera);
}

const cameraSink = { current: null as ((camera: Camera) => void) | null };

function markMetrics(width: number, height: number) {
  const edge = Math.min(width, height);
  return {
    strokeWidth: Math.max(DEFAULT_STROKE_WIDTH, Math.round(edge * 0.006 * 10) / 10),
    fontSize: Math.max(18, Math.round(edge * 0.045)),
    textWidth: Math.max(80, Math.round(edge * 0.4)),
  };
}

function onStageDown(
  event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  metrics: { strokeWidth: number; fontSize: number; textWidth: number },
  setDraft: (value: DrawingObject | null) => void,
  setSelected: (ids: string[]) => void,
  setEditing: (id: string | null) => void,
) {
  if (pinchRef.current) return;
  const stage = event.target.getStage();
  if (!stage) return;
  const pointer = stage.getPointerPosition();
  if (!pointer) return;
  const store = useSketchy.getState();
  const tool: Tool = DRAW_TOOLS.has(store.tool) || store.tool === "select" || store.tool === "pan" ? store.tool : "select";
  const middle = "button" in event.evt && event.evt.button === 1;
  if (tool === "pan" || spaceRef.current || middle) {
    dragRef.current = { mode: "pan", startScreen: pointer, startCamera: cameraRef.current };
    return;
  }
  if (tool === "select") {
    const name = event.target.name();
    if (event.target === stage || name === "paper" || name === "photo") setSelected([]);
    return;
  }
  const name = event.target.name();
  if (event.target !== stage && name !== "paper" && name !== "photo") return;
  const world = screenToWorld(cameraRef.current, pointer);
  if (tool === "text") {
    placeText(world, metrics, setSelected, setEditing);
    return;
  }
  dragRef.current = { mode: "draw", origin: world, tool };
  updateDraft(initialDraft(tool, world, store.stroke, store.fill, metrics.strokeWidth), setDraft);
}

function onStageMove(
  event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  metrics: { strokeWidth: number },
  setDraft: (value: DrawingObject | null) => void,
) {
  const drag = dragRef.current;
  if (!drag || pinchRef.current) return;
  const pointer = event.target.getStage()?.getPointerPosition();
  if (!pointer) return;
  if (drag.mode === "pan") {
    publish({
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
    if (!current || current.kind !== "freehand") return;
    const lastX = current.points?.[current.points.length - 2] ?? 0;
    const lastY = current.points?.[current.points.length - 1] ?? 0;
    const nextX = world.x - drag.origin.x;
    const nextY = world.y - drag.origin.y;
    if (Math.hypot(nextX - lastX, nextY - lastY) < 1.4) return;
    updateDraft({ ...current, points: [...(current.points ?? []), nextX, nextY] }, setDraft);
    return;
  }
  updateDraft(resizeDraft(drag.origin, drag.tool, world, stroke, fill, metrics.strokeWidth), setDraft);
}

function finishDraw(
  setDraftState: (value: DrawingObject | null) => void,
  setSelected: (ids: string[]) => void,
  setEditing: (id: string | null) => void,
) {
  const drag = dragRef.current;
  dragRef.current = null;
  if (!drag || drag.mode !== "draw") return;
  const draft = draftRef.current;
  draftRef.current = null;
  setDraftState(null);
  if (!draft || !isDrawable(draft)) return;
  const drawing = { ...draft, id: createId("draw") };
  const editId = editIdRef.current;
  useSketchy.getState().commit((project) => addDrawing(project, editId, drawing));
  useSketchy.getState().setTool("select");
  setSelected([drawing.id]);
  if (drawing.kind === "text") setEditing(drawing.id);
}

function placeText(
  world: Point,
  metrics: { strokeWidth: number; fontSize: number; textWidth: number },
  setSelected: (ids: string[]) => void,
  setEditing: (id: string | null) => void,
) {
  const { fill, stroke } = useSketchy.getState();
  const color = fill === "transparent" ? (stroke === "transparent" ? palette.ink : stroke) : fill;
  const drawing: DrawingObject = {
    id: createId("draw"),
    kind: "text",
    x: world.x,
    y: world.y,
    rotation: 0,
    width: metrics.textWidth,
    text: "Text",
    fontSize: metrics.fontSize,
    stroke: color,
    fill: color,
    strokeWidth: metrics.strokeWidth,
    opacity: 1,
  };
  useSketchy.getState().commit((project) => addDrawing(project, editIdRef.current, drawing));
  useSketchy.getState().setTool("select");
  setSelected([drawing.id]);
  setEditing(drawing.id);
}

function initialDraft(tool: Tool, origin: Point, stroke: string, fill: string, strokeWidth: number): DrawingObject {
  const base = { id: "draft", x: origin.x, y: origin.y, rotation: 0, stroke, fill, strokeWidth, opacity: 1 };
  if (tool === "arrow") return { ...base, kind: "arrow", points: [0, 0, 0, 0] };
  if (tool === "pen") return { ...base, kind: "freehand", points: [0, 0] };
  if (tool === "ellipse") return { ...base, kind: "ellipse", width: 0, height: 0 };
  return { ...base, kind: "rect", width: 0, height: 0 };
}

function resizeDraft(origin: Point, tool: Tool, world: Point, stroke: string, fill: string, strokeWidth: number): DrawingObject {
  const x = Math.min(origin.x, world.x);
  const y = Math.min(origin.y, world.y);
  const width = Math.abs(world.x - origin.x);
  const height = Math.abs(world.y - origin.y);
  if (tool === "arrow") {
    return {
      id: "draft",
      kind: "arrow",
      x: origin.x,
      y: origin.y,
      rotation: 0,
      points: [0, 0, world.x - origin.x, world.y - origin.y],
      stroke,
      fill: stroke,
      strokeWidth,
      opacity: 1,
    };
  }
  return {
    id: "draft",
    kind: tool === "ellipse" ? "ellipse" : "rect",
    x,
    y,
    rotation: 0,
    width,
    height,
    stroke,
    fill,
    strokeWidth,
    opacity: 1,
  };
}

function updateDraft(next: DrawingObject | null, setDraft: (value: DrawingObject | null) => void) {
  draftRef.current = next;
  setDraft(next);
}

function isDrawable(drawing: DrawingObject): boolean {
  if (drawing.kind === "rect" || drawing.kind === "ellipse") {
    return (drawing.width ?? 0) >= 4 || (drawing.height ?? 0) >= 4;
  }
  const pts = drawing.points ?? [];
  const dx = (pts[pts.length - 2] ?? 0) - (pts[0] ?? 0);
  const dy = (pts[pts.length - 1] ?? 0) - (pts[1] ?? 0);
  return Math.hypot(dx, dy) >= 3 || pts.length > 6;
}

function paintDrawings(color: string, selected: string[]) {
  const store = useSketchy.getState();
  store.setInk(color);
  if (selected.length === 0) return;
  const patch = store.colorTarget === "stroke" ? { stroke: color } : { fill: color };
  store.commit((project) => recolorDrawings(project, editIdRef.current, selected, patch));
}

function deleteSelected(setSelected: (ids: string[]) => void) {
  const ids = selectedIds();
  if (ids.length === 0) return;
  useSketchy.getState().commit((project) => removeDrawings(project, editIdRef.current, ids));
  setSelected([]);
}

function duplicateSelected(setSelected: (ids: string[]) => void) {
  const ids = selectedIds();
  if (ids.length === 0) return;
  const result = duplicateDrawings(useSketchy.getState().history.present, editIdRef.current, ids, createId);
  useSketchy.getState().commit(() => result.project);
  setSelected(result.ids);
}

const selectedSink = { current: [] as string[] };

function selectedIds(): string[] {
  return selectedSink.current;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function bindStudioSelection(ids: string[], setCamera: (camera: Camera) => void) {
  selectedSink.current = ids;
  cameraSink.current = setCamera;
}
