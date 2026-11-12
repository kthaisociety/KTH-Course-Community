"use client";

import { Check, CircleAlert, TriangleAlert, X } from "lucide-react";
import type { DragEvent, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { PlanItem } from "../lib/build-plan";

export const DRAG_TYPE = "application/x-kth-plan-course";

type Props = {
  item: PlanItem;
  /** First and last grid column (1-based) this bar covers in its year row. */
  col: number;
  span: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  warnings: number;
  selected: boolean;
  onSelect: () => void;
  onNudge: (direction: -1 | 1) => void;
};

/**
 * One course in the year grid: code, name, credits and pace, with the state
 * in an icon as well as a colour — passed (✓), not passed (✗), warnings (⚠).
 * Draggable on a pointer; ← and → move a selected bar one period, for the
 * keyboard; the side panel's "Move to" does the same on a phone.
 */
export function CourseBar({
  item,
  col,
  span,
  continuesLeft,
  continuesRight,
  warnings,
  selected,
  onSelect,
  onNudge,
}: Props) {
  const status =
    item.status === "passed"
      ? "Passed"
      : item.status === "not-passed"
        ? "Not passed, period has ended"
        : item.status === "in-progress"
          ? "In progress"
          : "Planned";
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, item.code);
    e.dataTransfer.setData("text/plain", item.code);
    e.dataTransfer.effectAllowed = "move";
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    } else if (selected && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      onNudge(e.key === "ArrowLeft" ? -1 : 1);
    }
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a draggable bar holds a two-line title and icons, which a <button> can't lay out as a grid item.
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      aria-pressed={selected}
      aria-label={`${item.code} ${item.title}, ${item.credits} hp, ${status}${warnings ? `, ${warnings} warning${warnings > 1 ? "s" : ""}` : ""}`}
      title={`${status}${item.pace ? ` · ${item.pace} % pace` : ""}`}
      style={{ gridColumn: `${col} / span ${span}` }}
      className={cn(
        "group relative flex min-h-[64px] cursor-grab self-start flex-col gap-1 rounded-[12px] border px-3 py-2.5 text-left outline-none transition-[box-shadow,border-color] active:cursor-grabbing",
        "focus-visible:ring-[3px] focus-visible:ring-cc-focus/40",
        item.status === "passed" &&
          "border-cc-success-tint-border bg-cc-success-tint",
        item.status === "not-passed" &&
          "border-cc-danger-tint-border border-dashed bg-cc-danger-tint",
        item.status === "in-progress" && "border-cc-brand/40 bg-cc-info-solid",
        item.status === "planned" && "border-cc-rule2 bg-cc-surface",
        warnings > 0 && item.status !== "not-passed" && "border-cc-warn-border",
        selected && "ring-[3px] ring-cc-focus/35",
        continuesLeft && "rounded-l-[4px]",
        continuesRight && "rounded-r-[4px]",
      )}
    >
      <span className="flex items-center justify-between gap-2 font-mono text-[11.5px] text-cc-brand">
        <span className="flex min-w-0 items-center gap-1.5">
          {item.status === "passed" ? (
            <Check
              aria-hidden
              size={13}
              strokeWidth={3}
              className="shrink-0 text-cc-success-ink"
            />
          ) : item.status === "not-passed" ? (
            <X
              aria-hidden
              size={13}
              strokeWidth={3}
              className="shrink-0 text-cc-danger-ink"
            />
          ) : warnings > 0 ? (
            <TriangleAlert
              aria-hidden
              size={13}
              className="shrink-0 text-cc-warn-ink"
            />
          ) : item.offPeriod ? (
            <CircleAlert
              aria-hidden
              size={13}
              className="shrink-0 text-cc-dim"
            />
          ) : null}
          <span className="truncate">{item.code}</span>
        </span>
      </span>
      <span className="line-clamp-2 text-[12.5px] text-cc-ink leading-snug">
        {item.title}
      </span>
      {/* Credits and pace on their own line, so a narrow period never truncates the code. */}
      <span className="mt-auto text-[11.5px] text-cc-muted tabular-nums">
        {item.credits.toLocaleString("sv-SE")} hp
        {item.pace ? ` · ${item.pace} % pace` : ""}
      </span>
    </div>
  );
}
