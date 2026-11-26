"use client";

import { ChevronDown, type LucideIcon, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type Period, type Slot, slotIndex } from "../lib/slots";
import type { SlotOption } from "./course-tray";

type Props = {
  options: SlotOption[];
  /** The period the course sits in now, if it is placed. */
  current?: Slot | null;
  /** Periods the course's rounds start in, marked so the right choice stands out. */
  starts?: readonly Period[];
  onPick: (slot: Slot) => void;
  /** What the closed control says, e.g. "Add to plan…". */
  label: ReactNode;
  /** Names the control for assistive tech, e.g. "Add DH2642 to a period". */
  ariaLabel: string;
  /**
   * `field` shows the current choice with a chevron, like a select; `button`
   * is an action ("Add to plan") that opens the same grid.
   */
  variant?: "field" | "button";
  /** The `button` variant's icon; a plus by default. */
  icon?: LucideIcon;
  /** Which edge of the control the grid lines up with. */
  align?: "start" | "end";
  className?: string;
};

/**
 * Choosing a period, as a grid rather than a twenty-line list: one row per
 * study year, its periods as buttons. Periods the course is given in are
 * tinted green, so a student picks a period that works instead of one that warns. The
 * native select it replaces drew its options in the OS's own colours, light on
 * white in the dark theme.
 */
export function SlotPicker({
  options,
  current,
  starts = [],
  onPick,
  label,
  ariaLabel,
  variant = "field",
  icon: Icon = Plus,
  align = "end",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const years: { ay: number; slots: SlotOption[] }[] = [];
  for (const o of options) {
    const last = years.at(-1);
    if (last && last.ay === o.slot.ay) last.slots.push(o);
    else years.push({ ay: o.slot.ay, slots: [o] });
  }
  const currentIdx = current ? slotIndex(current) : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-cc-focus/30",
          variant === "field"
            ? "justify-between border border-cc-rule2 bg-cc-surface text-cc-ink hover:bg-cc-pill data-[state=open]:bg-cc-pill"
            : "justify-center bg-cc-btn font-medium text-cc-btn-fg hover:opacity-90",
          className,
        )}
      >
        {variant === "button" ? (
          <Icon aria-hidden size={15} strokeWidth={2.4} className="shrink-0" />
        ) : null}
        <span className="truncate">{label}</span>
        {variant === "field" ? (
          <ChevronDown
            aria-hidden
            size={15}
            className="shrink-0 text-cc-muted"
          />
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="scrollbar-subtle max-h-[min(420px,var(--radix-popover-content-available-height))] w-[288px] gap-1 overflow-y-auto rounded-[14px] border border-cc-rule bg-cc-surface p-2 text-cc-ink shadow-[0_18px_48px_-12px_rgba(20,30,45,0.45)] ring-0"
      >
        {years.map(({ ay, slots }, i) => (
          <div key={ay} className="px-1 py-1.5">
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <span className="font-semibold text-[12.5px]">Year {i + 1}</span>
              <span className="text-[11.5px] text-cc-muted tabular-nums">
                {ay}–{String(ay + 1).slice(2)}
              </span>
            </div>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`,
              }}
            >
              {slots.map((o) => {
                const given = starts.includes(o.slot.p);
                const here = currentIdx === slotIndex(o.slot);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-label={`${o.label}${given ? ", given then" : ""}${here ? ", current" : ""}`}
                    aria-current={here ? "true" : undefined}
                    onClick={() => {
                      onPick(o.slot);
                      setOpen(false);
                    }}
                    className={cn(
                      "relative flex h-9 cursor-pointer items-center justify-center rounded-[10px] font-medium text-[12.5px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-cc-focus/30",
                      here
                        ? "bg-cc-btn text-cc-btn-fg"
                        : given
                          ? "bg-cc-success-tint text-cc-success-ink hover:ring-1 hover:ring-cc-success-tint-border"
                          : "bg-cc-pill text-cc-chip-ink hover:bg-cc-checked-hover-tint",
                    )}
                  >
                    {o.slot.p === 5 ? "Sum" : `P${o.slot.p}`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {starts.length ? (
          <p className="flex items-center gap-1.5 border-cc-rule border-t px-2 pt-2 pb-1 text-[11.5px] text-cc-muted">
            <span
              aria-hidden
              className="size-2.5 rounded-[3px] bg-cc-success-tint ring-1 ring-cc-success-tint-border"
            />
            Given in this period
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
