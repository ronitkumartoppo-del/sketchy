import { createFileRoute } from "@tanstack/react-router";
import { objectCount } from "@/sketchy/model/ops";
import { useSketchy } from "@/sketchy/store/use-sketchy";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projects — Sketchy" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const ready = useSketchy((state) => state.ready);
  const project = useSketchy((state) => state.history.present);
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-3xl italic">Projects</h1>
      {ready ? (
        <div className="text-sm leading-relaxed text-muted">
          <p className="text-base text-ink">{project.name}</p>
          <p className="mt-2">
            {project.boards.length} {project.boards.length === 1 ? "board" : "boards"} · {objectCount(project)} objects ·{" "}
            {Object.keys(project.assets).length} original {Object.keys(project.assets).length === 1 ? "image" : "images"}
          </p>
          <p className="mt-3">
            This working session is stored in this browser. A downloadable .sketchy file is not built yet — a PNG of the current view is available from Mindspace, and it is not the editable project.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">Restoring this browser session…</p>
      )}
    </div>
  );
}
