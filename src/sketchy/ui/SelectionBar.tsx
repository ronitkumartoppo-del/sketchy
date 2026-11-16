import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Copy, Lock, LockOpen, Trash2 } from "lucide-react";
import { SWATCHES } from "../model/palette";
import { groupMembers } from "../model/ops";
import { downloadEditedPicture, downloadFramePicture } from "../canvas/export-picture";
import { useSketchy } from "../store/use-sketchy";
import { IconButton } from "./IconButton";

export function SelectionBar() {
  const selection = useSketchy((state) => state.selection);
  const project = useSketchy((state) => state.history.present);
  const colorTarget = useSketchy((state) => state.colorTarget);
  const setColorTarget = useSketchy((state) => state.setColorTarget);
  const paint = useSketchy((state) => state.paint);
  const duplicate = useSketchy((state) => state.duplicate);
  const toggleLock = useSketchy((state) => state.toggleLock);
  const reorder = useSketchy((state) => state.reorder);
  const removeSelection = useSketchy((state) => state.removeSelection);
  if (selection.length === 0) return null;

  const objects = project.boards.flatMap((board) => board.objects).filter((object) => selection.includes(object.id));
  const boardObjects = project.boards.flatMap((board) => board.objects);
  const imagesOnly = objects.length > 0 && objects.every((object) => object.type === "image");
  const locked = objects.length > 0 && objects.every((object) => object.locked);
  const canGroup = groupMembers(boardObjects, selection) !== null;
  const canUngroup = objects.some((object) => object.type === "group" || object.type === "frame");

  return (
    <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center justify-center gap-2">
      <div className="flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-line bg-surface px-2 py-1 shadow-sm">
        {objects.length === 1 && objects[0]?.type === "image" ? (
          <>
            <Link
              to="/studio"
              search={{ edit: objects[0].imageProjectId }}
              className="rounded-full bg-accent px-3 py-2 text-xs font-medium text-paper"
            >
              Edit image
            </Link>
            <button
              type="button"
              className="rounded-full px-3 py-2 text-xs font-medium text-ink"
              onClick={() => {
                const image = objects[0];
                if (image?.type === "image") void downloadEditedPicture(image.imageProjectId);
              }}
            >
              Save PNG
            </button>
          </>
        ) : imagesOnly ? (
          <p className="px-2 text-xs text-muted">Select one image. The original file stays untouched.</p>
        ) : (
          <>
            <div className="flex rounded-full bg-paper p-0.5 text-xs">
              <button
                type="button"
                className={
                  "rounded-full px-2 py-1 " + (colorTarget === "stroke" ? "bg-ink text-paper" : "text-muted")
                }
                onClick={() => setColorTarget("stroke")}
              >
                Stroke
              </button>
              <button
                type="button"
                className={"rounded-full px-2 py-1 " + (colorTarget === "fill" ? "bg-ink text-paper" : "text-muted")}
                onClick={() => setColorTarget("fill")}
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
                onClick={() => paint(swatch.value)}
                className="grid size-8 place-items-center rounded-full border border-line"
                style={{
                  background:
                    swatch.value === "transparent"
                      ? "repeating-linear-gradient(135deg, #fffdf8, #fffdf8 3px, #e3d9c8 3px, #e3d9c8 5px)"
                      : swatch.value,
                }}
              />
            ))}
          </>
        )}
        {objects.length === 1 && objects[0]?.type === "frame" ? (
          <button
            type="button"
            className="rounded-full px-3 py-2 text-xs font-medium text-ink"
            onClick={() => {
              const frame = objects[0];
              if (frame?.type === "frame") void downloadFramePicture(frame.id);
            }}
          >
            Save PNG
          </button>
        ) : null}
        {canGroup ? (
          <button
            type="button"
            className="rounded-full px-3 py-2 text-xs font-medium text-ink"
            onClick={() => useSketchy.getState().groupSelection()}
          >
            Group
          </button>
        ) : null}
        {canUngroup ? (
          <button
            type="button"
            className="rounded-full px-3 py-2 text-xs font-medium text-ink"
            onClick={() => useSketchy.getState().ungroupSelection()}
          >
            Ungroup
          </button>
        ) : null}
        <IconButton label="Duplicate" side="top" onClick={duplicate}>
          <Copy className="size-5" />
        </IconButton>
        <IconButton label={locked ? "Unlock" : "Lock"} side="top" onClick={toggleLock}>
          {locked ? <Lock className="size-5" /> : <LockOpen className="size-5" />}
        </IconButton>
        <IconButton label="Bring forward" side="top" onClick={() => reorder("forward")}>
          <ArrowUp className="size-5" />
        </IconButton>
        <IconButton label="Send backward" side="top" onClick={() => reorder("backward")}>
          <ArrowDown className="size-5" />
        </IconButton>
        <IconButton label="Delete" side="top" onClick={removeSelection}>
          <Trash2 className="size-5" />
        </IconButton>
      </div>
    </div>
  );
}
