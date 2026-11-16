import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { objectCount } from "@/sketchy/model/ops";
import { downloadCurrentProject, openSketchyFile } from "@/sketchy/storage/transfer";
import { useSketchy } from "@/sketchy/store/use-sketchy";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projects — Sketchy" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const ready = useSketchy((state) => state.ready);
  const project = useSketchy((state) => state.history.present);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onDownload() {
    setBusy(true);
    try {
      const { missing } = await downloadCurrentProject();
      if (missing.length > 0) {
        toast.error(
          `${missing.length} original ${missing.length === 1 ? "image is" : "images are"} missing from this browser. The file still has the boards and marks.`,
        );
      } else {
        toast.success("Downloaded a .sketchy file. It is the editable project, not a flattened PNG.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that file.");
    } finally {
      setBusy(false);
    }
  }

  async function onOpen(file: File) {
    const current = useSketchy.getState().history.present;
    const occupied = objectCount(current) > 0 || Object.keys(current.assets).length > 0;
    if (occupied && !window.confirm("Open this file? It replaces the session in this browser.")) return;
    setBusy(true);
    try {
      const opened = await openSketchyFile(file);
      if (opened.missing.length > 0) {
        toast.error(
          `Opened ${opened.name}. ${opened.missing.length} original ${opened.missing.length === 1 ? "image is" : "images are"} missing.`,
        );
      } else {
        toast.success(`Opened ${opened.name}. Marks and crops are still editable.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't open that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl italic">Projects</h1>
      {ready ? (
        <>
          <div className="text-sm leading-relaxed text-muted">
            <p className="text-base text-ink">{project.name}</p>
            <p className="mt-2">
              {project.boards.length} {project.boards.length === 1 ? "board" : "boards"} · {objectCount(project)} objects ·{" "}
              {Object.keys(project.assets).length} original {Object.keys(project.assets).length === 1 ? "image" : "images"}
            </p>
            <p className="mt-3">
              A .sketchy file keeps the boards, masks, and drawings. The pictures inside it are the originals, not a flattened PNG.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDownload()}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-40"
            >
              Download .sketchy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
            >
              Open .sketchy
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".sketchy,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onOpen(file);
              }}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Restoring this browser session…</p>
      )}
    </div>
  );
}
