import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  COMPARISON_EXPORT,
  COMPARISON_FILENAME,
  defaultComparePair,
  findCompareSource,
  listCompareSources,
  slotLabel,
  slotSkipsAdjustments,
  type CompareLayout,
  type CompareSlot,
} from "../model/compare";
import type { ImageEditProject } from "../model/types";
import { useSketchy } from "../store/use-sketchy";
import { renderComparison, renderSource, type SourcePaint } from "./compare-paint";

function useHtmlImage(url: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    let live = true;
    const element = new window.Image();
    element.onload = () => {
      if (live) setImage(element);
    };
    element.src = url;
    return () => {
      live = false;
      element.onload = null;
    };
  }, [url]);
  return image;
}

function sourcePaint(
  projectEdit: ImageEditProject | undefined,
  image: HTMLImageElement | null,
  width: number,
  height: number,
): SourcePaint {
  return {
    image,
    width,
    height,
    mask: projectEdit?.mask ?? null,
    drawings: projectEdit?.drawings ?? [],
  };
}

export function CompareView() {
  const ready = useSketchy((state) => state.ready);
  const project = useSketchy((state) => state.history.present);
  const urls = useSketchy((state) => state.assetUrls);
  const sources = useMemo(() => listCompareSources(project), [project]);
  const [pair, setPair] = useState<{ a: CompareSlot; b: CompareSlot } | null>(null);
  const [layout, setLayout] = useState<CompareLayout>("side");
  const [fade, setFade] = useState(0.5);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<{ a: HTMLCanvasElement; b: HTMLCanvasElement } | null>(null);
  const frameRef = useRef({ layout, fade, labelA: "", labelB: "" });
  const drawRef = useRef(() => {});

  useEffect(() => {
    setPair((current) => {
      if (
        current &&
        sources.some((source) => source.objectId === current.a.objectId) &&
        sources.some((source) => source.objectId === current.b.objectId)
      ) {
        return current;
      }
      return defaultComparePair(sources);
    });
  }, [sources]);

  const sourceA = pair ? findCompareSource(sources, pair.a.objectId) : undefined;
  const sourceB = pair ? findCompareSource(sources, pair.b.objectId) : undefined;
  const imageA = useHtmlImage(sourceA ? urls[sourceA.assetId] : undefined);
  const imageB = useHtmlImage(sourceB ? urls[sourceB.assetId] : undefined);
  const editA = sourceA ? project.imageProjects[sourceA.imageProjectId] : undefined;
  const editB = sourceB ? project.imageProjects[sourceB.imageProjectId] : undefined;
  const pendingAdjustments = pair ? slotSkipsAdjustments(project, pair.a) || slotSkipsAdjustments(project, pair.b) : false;

  frameRef.current = {
    layout,
    fade,
    labelA: sourceA && pair ? slotLabel(sourceA, pair.a.view) : "",
    labelB: sourceB && pair ? slotLabel(sourceB, pair.b.view) : "",
  };

  drawRef.current = () => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const painted = paintRef.current;
    const frame = frameRef.current;
    if (!host || !canvas || !painted) return;
    const width = Math.max(1, Math.floor(host.clientWidth));
    const height = Math.max(1, Math.floor(host.clientHeight));
    if (width < 2 || height < 2) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const picture = renderComparison({
      a: painted.a,
      b: painted.b,
      layout: frame.layout,
      fade: frame.fade,
      labelA: frame.labelA,
      labelB: frame.labelB,
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    });
    canvas.width = picture.width;
    canvas.height = picture.height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.getContext("2d")?.drawImage(picture, 0, 0);
  };

  useEffect(() => {
    if (!pair || !sourceA || !sourceB) {
      paintRef.current = null;
      return;
    }
    const aReady = !urls[sourceA.assetId] || Boolean(imageA);
    const bReady = !urls[sourceB.assetId] || Boolean(imageB);
    if (!aReady || !bReady) return;
    paintRef.current = {
      a: renderSource(sourcePaint(editA, imageA, sourceA.width, sourceA.height), pair.a.view),
      b: renderSource(sourcePaint(editB, imageB, sourceB.width, sourceB.height), pair.b.view),
    };
    drawRef.current();
  }, [pair, sourceA, sourceB, imageA, imageB, editA, editB, urls]);

  useEffect(() => {
    drawRef.current();
  }, [layout, fade, pair]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => drawRef.current());
    observer.observe(host);
    drawRef.current();
    return () => observer.disconnect();
  }, [ready, sources.length]);

  function setSlot(which: "a" | "b", patch: Partial<CompareSlot>) {
    setPair((current) => (current ? { ...current, [which]: { ...current[which], ...patch } } : current));
  }

  function download() {
    const painted = paintRef.current;
    if (!painted || !pair || !sourceA || !sourceB) return;
    const picture = renderComparison({
      a: painted.a,
      b: painted.b,
      layout,
      fade,
      labelA: slotLabel(sourceA, pair.a.view),
      labelB: slotLabel(sourceB, pair.b.view),
      width: COMPARISON_EXPORT.width,
      height: COMPARISON_EXPORT.height,
    });
    const link = document.createElement("a");
    link.href = picture.toDataURL("image/png");
    link.download = COMPARISON_FILENAME;
    link.click();
    toast.success("Downloaded a comparison picture. It is not a .sketchy project.");
  }

  if (!ready) {
    return <p className="grid h-full place-items-center text-sm text-muted">Restoring this browser session…</p>;
  }

  if (!pair || sources.length === 0) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-3xl italic">Compare</h1>
        <p className="text-sm leading-relaxed text-muted">
          Add an image on Mindspace first. Compare can line up two pictures, or the original file against the current crop and marks on one picture.
        </p>
        <Link to="/" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper">
          Back to Mindspace
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <LayoutButton active={layout === "side"} onClick={() => setLayout("side")}>
          Side by side
        </LayoutButton>
        <LayoutButton active={layout === "overlay"} onClick={() => setLayout("overlay")}>
          Overlay
        </LayoutButton>
        {layout === "overlay" ? (
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
            Fade
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(fade * 100)}
              aria-label="Overlay fade"
              className="w-36 accent-accent"
              onChange={(event) => setFade(Number(event.target.value) / 100)}
            />
          </label>
        ) : null}
        <p className="min-w-0 text-sm text-muted">
          {sources.length === 1 ? "One image. Original next to the current crop and marks." : "Pick any two pictures in this session."}
        </p>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 bg-paper">
        <canvas ref={canvasRef} className="block h-full w-full" aria-label="Comparison" />
      </div>
      <div className="flex flex-col gap-3 border-t border-line bg-surface px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <SlotControls label="A" sources={sources} slot={pair.a} onChange={(patch) => setSlot("a", patch)} />
          <SlotControls label="B" sources={sources} slot={pair.b} onChange={(patch) => setSlot("b", patch)} />
          <button type="button" onClick={download} className="min-h-11 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper">
            Download comparison PNG
          </button>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          This PNG is a picture of the comparison. It is not a .sketchy project, and it does not replace the original images.
          {pendingAdjustments ? " Brightness and the other adjustments are not drawn here yet." : ""}
        </p>
      </div>
    </div>
  );
}

function LayoutButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "min-h-11 rounded-full px-3 py-2 text-sm font-medium " +
        (active ? "bg-ink text-paper" : "text-muted hover:bg-line hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function SlotControls({
  label,
  sources,
  slot,
  onChange,
}: {
  label: string;
  sources: ReturnType<typeof listCompareSources>;
  slot: CompareSlot;
  onChange: (patch: Partial<CompareSlot>) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="font-display text-lg italic">{label}</span>
      <select
        aria-label={`Image ${label}`}
        value={slot.objectId}
        onChange={(event) => onChange({ objectId: event.target.value })}
        className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-paper px-3 text-sm"
      >
        {sources.map((source) => (
          <option key={source.objectId} value={source.objectId}>
            {source.label}
          </option>
        ))}
      </select>
      <ViewButton active={slot.view === "original"} onClick={() => onChange({ view: "original" })}>
        Original
      </ViewButton>
      <ViewButton active={slot.view === "edited"} onClick={() => onChange({ view: "edited" })}>
        Current
      </ViewButton>
    </div>
  );
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "min-h-11 rounded-full px-3 py-2 text-sm " + (active ? "bg-ink text-paper" : "text-muted hover:bg-line hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
