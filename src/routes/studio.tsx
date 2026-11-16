import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useSketchy } from "@/sketchy/store/use-sketchy";

type StudioSearch = { edit?: string };
type StudioView = ComponentType<{ editId: string }>;

export const Route = createFileRoute("/studio")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    edit: typeof search.edit === "string" && search.edit.length > 0 ? search.edit : undefined,
  }),
  head: () => ({ meta: [{ title: "Image Studio — Sketchy" }] }),
  component: StudioPage,
});

function StudioPage() {
  const { edit } = Route.useSearch();
  const ready = useSketchy((state) => state.ready);
  const exists = useSketchy((state) => (edit ? Boolean(state.history.present.imageProjects[edit]) : false));
  const [View, setView] = useState<StudioView | null>(null);

  useEffect(() => {
    if (!edit || !exists) return;
    let live = true;
    void import("@/sketchy/canvas/StudioCanvas").then((mod) => {
      if (live) setView(() => mod.StudioCanvas);
    });
    return () => {
      live = false;
    };
  }, [edit, exists]);

  if (!ready) {
    return <p className="grid h-full place-items-center text-sm text-muted">Restoring this browser session…</p>;
  }
  if (!edit || !exists) return <StudioPicker missing={Boolean(edit)} />;
  if (!View) {
    return <p className="grid h-full place-items-center text-sm text-muted">Opening Image Studio…</p>;
  }
  return (
    <div className="h-full">
      <View editId={edit} />
    </div>
  );
}

function StudioPicker({ missing }: { missing: boolean }) {
  const project = useSketchy((state) => state.history.present);
  const urls = useSketchy((state) => state.assetUrls);
  const images = useMemo(() => {
    const items: { editId: string; name: string; url?: string; drawings: number }[] = [];
    for (const board of project.boards) {
      for (const object of board.objects) {
        if (object.type !== "image") continue;
        const asset = project.assets[object.assetId];
        items.push({
          editId: object.imageProjectId,
          name: asset?.name ?? "Untitled image",
          url: urls[object.assetId],
          drawings: project.imageProjects[object.imageProjectId]?.drawings.length ?? 0,
        });
      }
    }
    return items;
  }, [project, urls]);

  if (images.length === 0) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-3xl italic">Image Studio</h1>
        <p className="text-sm leading-relaxed text-muted">
          Add an image on Mindspace first. Studio draws on a copy of the edit project and leaves the original file alone. Crop is not in this step.
        </p>
        <Link to="/" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
          Back to Mindspace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 overflow-auto px-4 py-6">
      <div>
        <h1 className="font-display text-3xl italic">Image Studio</h1>
        <p className="mt-1 text-sm text-muted">
          {missing
            ? "That image is no longer in this session. Pick another. The original file is not flattened."
            : "Pick an image. Marks stay separate from the file you imported. Crop is not in this step."}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image) => (
          <li key={image.editId}>
            <Link
              to="/studio"
              search={{ edit: image.editId }}
              className="block overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <span className="grid aspect-[4/3] place-items-center bg-paper">
                {image.url ? (
                  <img src={image.url} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-3 text-xs text-muted">Missing file</span>
                )}
              </span>
              <span className="block truncate px-3 py-2 text-sm">{image.name}</span>
              <span className="block px-3 pb-3 text-xs text-muted">
                {image.drawings} {image.drawings === 1 ? "drawing" : "drawings"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
