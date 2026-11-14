import { createFileRoute } from "@tanstack/react-router";
import { useSketchy } from "@/sketchy/store/use-sketchy";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [{ title: "Image Studio — Sketchy" }] }),
  component: StudioPage,
});

function StudioPage() {
  const ready = useSketchy((state) => state.ready);
  const count = useSketchy((state) => Object.keys(state.history.present.imageProjects).length);
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-3xl italic">Image Studio</h1>
      <p className="text-sm leading-relaxed text-muted">
        {ready
          ? `This session has ${count} image edit ${count === 1 ? "project" : "projects"}. Studio drawing, freeform crop, and adjustments are not built yet. Originals stay attached to the board instead of being flattened.`
          : "Restoring this browser session…"}
      </p>
    </div>
  );
}
