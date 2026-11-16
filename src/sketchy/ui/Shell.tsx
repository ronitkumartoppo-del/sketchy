import { Link, useRouterState } from "@tanstack/react-router";
import { Redo2, Undo2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { flushPersist, schedulePersist, bootstrapSession } from "../storage/session";
import { useSketchy } from "../store/use-sketchy";
import { IconButton } from "./IconButton";

const NAV = [
  { to: "/", label: "Mindspace" },
  { to: "/studio", label: "Image Studio" },
  { to: "/compare", label: "Compare" },
  { to: "/projects", label: "Projects" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const ready = useSketchy((state) => state.ready);
  const project = useSketchy((state) => state.history.present);
  const canUndo = useSketchy((state) => state.history.past.length > 0);
  const canRedo = useSketchy((state) => state.history.future.length > 0);
  const undo = useSketchy((state) => state.undo);
  const redo = useSketchy((state) => state.redo);

  useEffect(() => {
    bootstrapSession();
  }, []);

  useEffect(() => {
    if (!ready) return;
    schedulePersist(project);
  }, [project, ready]);

  useEffect(() => {
    const flush = () => {
      if (useSketchy.getState().ready) flushPersist(useSketchy.getState().history.present);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Link to="/" className="flex items-baseline gap-2 pr-1">
          <span className="font-display text-2xl leading-none italic">Sketchy</span>
          <span className="hidden text-xs tracking-wide text-muted sm:inline">Be Sketchy.</span>
        </Link>
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "shrink-0 rounded-full px-3 py-2 text-sm font-medium " +
                  (active ? "bg-ink text-paper" : "text-muted hover:bg-line hover:text-ink")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center">
          <IconButton label="Undo" side="bottom" disabled={!canUndo} onClick={undo}>
            <Undo2 className="size-5" />
          </IconButton>
          <IconButton label="Redo" side="bottom" disabled={!canRedo} onClick={redo}>
            <Redo2 className="size-5" />
          </IconButton>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
      <Toaster position="bottom-center" />
    </div>
  );
}
