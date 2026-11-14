import { ArrowUpRight, Circle, Crop, Hand, Lasso, MousePointer2, Pentagon, Pencil, Spline, Square, Type } from "lucide-react";
import type { Tool } from "../model/types";
import { useSketchy } from "../store/use-sketchy";
import { IconButton } from "./IconButton";

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select (V)", icon: MousePointer2 },
  { id: "pan", label: "Pan (H)", icon: Hand },
  { id: "pen", label: "Pen (P)", icon: Pencil },
  { id: "curve", label: "Curve (B)", icon: Spline },
  { id: "rect", label: "Rectangle (R)", icon: Square },
  { id: "ellipse", label: "Ellipse (O)", icon: Circle },
  { id: "arrow", label: "Arrow (A)", icon: ArrowUpRight },
  { id: "text", label: "Text (T)", icon: Type },
];

export type CropTool = "lasso" | "polygon" | "rect";

const CROPS: { id: CropTool; label: string; icon: typeof Lasso }[] = [
  { id: "lasso", label: "Lasso crop (L)", icon: Lasso },
  { id: "polygon", label: "Polygon crop (G)", icon: Pentagon },
  { id: "rect", label: "Rectangle crop (C)", icon: Crop },
];

export function StudioRail({ crop, onCrop }: { crop: CropTool | null; onCrop: (tool: CropTool | null) => void }) {
  const tool = useSketchy((state) => state.tool);
  const setTool = useSketchy((state) => state.setTool);
  const side = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "top" : "right";

  return (
    <div className="flex h-16 shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-surface px-2 md:h-full md:w-16 md:flex-col md:overflow-y-auto md:border-t-0 md:border-r md:py-2">
      {TOOLS.map((item) => {
        const Icon = item.icon;
        return (
          <IconButton
            key={item.id}
            label={item.label}
            side={side}
            active={!crop && tool === item.id}
            onClick={() => {
              onCrop(null);
              setTool(item.id);
            }}
          >
            <Icon className="size-5" />
          </IconButton>
        );
      })}
      <span className="mx-1 hidden h-6 w-px bg-line md:mx-0 md:my-1 md:h-px md:w-6" />
      {CROPS.map((item) => {
        const Icon = item.icon;
        return (
          <IconButton
            key={item.id}
            label={item.label}
            side={side}
            active={crop === item.id}
            onClick={() => onCrop(crop === item.id ? null : item.id)}
          >
            <Icon className="size-5" />
          </IconButton>
        );
      })}
    </div>
  );
}
