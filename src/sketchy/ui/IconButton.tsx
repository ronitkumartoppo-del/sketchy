import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export function IconButton({
  label,
  children,
  active = false,
  disabled = false,
  onClick,
  side = "right",
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={
            "grid size-11 shrink-0 place-items-center rounded-xl transition-colors duration-150 " +
            (active ? "bg-ink text-paper" : "text-ink hover:bg-line") +
            " disabled:opacity-40"
          }
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={8}
          className="z-50 rounded-md bg-ink px-2 py-1 text-xs text-paper"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
