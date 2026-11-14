import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare — Sketchy" }] }),
  component: ComparePage,
});

function ComparePage() {
  const [View, setView] = useState<ComponentType | null>(null);
  useEffect(() => {
    let live = true;
    void import("@/sketchy/canvas/CompareView").then((mod) => {
      if (live) setView(() => mod.CompareView);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!View) {
    return <p className="grid h-full place-items-center text-sm text-muted">Opening Compare…</p>;
  }
  return <View />;
}
