import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Mindspace — Sketchy" }] }),
  component: MindspacePage,
});

function MindspacePage() {
  const [View, setView] = useState<ComponentType | null>(null);
  useEffect(() => {
    let live = true;
    void import("@/sketchy/canvas/MindspaceCanvas").then((mod) => {
      if (live) setView(() => mod.MindspaceCanvas);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!View) {
    return <p className="grid h-full place-items-center text-sm text-muted">Opening Mindspace…</p>;
  }
  return (
    <div className="h-full">
      <View />
    </div>
  );
}
