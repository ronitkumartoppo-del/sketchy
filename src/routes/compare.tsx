import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare — Sketchy" }] }),
  component: ComparePage,
});

function ComparePage() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-3xl italic">Compare</h1>
      <p className="text-sm leading-relaxed text-muted">
        Side-by-side comparison is not built yet. It will line up two images, fade an overlay, and export the comparison without accounts or a cloud upload.
      </p>
    </div>
  );
}
