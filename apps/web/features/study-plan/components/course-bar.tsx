"use client";

import { Check, CircleDot, TriangleAlert, X } from "lucide-react";
import type { DragEvent, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { PlanItem } from "../lib/build-plan";
import { StatusPill } from "./status-pill";

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
  className?: string;
};

const STATUS_WORD: Record<PlanItem["status"], string> = {
  passed: "Passed",
  "not-passed": "Not passed, period has ended",
  "in-progress": "In progress",
  planned: "Planned",
  unplaced: "Passed",
};

/**
 * One course in the year grid: code, name, credits and pace.
 *
 * Every bar is the same quiet surface; its state is a pill in the corner —
 * passed (✓), now, not passed (✗) or a warning count (⚠) — so the grid reads
 * as one plan rather than a patchwork of tints. A course that is only planned
 * shows no pill: planned is the default, and the default needs no label.
 * Draggable on a pointer; ← and → move a selected bar one period, for the
 * keyboard; the side panel's "Move course" does the same on a phone.
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
  className,
}: Props) {
  const status = STATUS_WORD[item.status];
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
  const pill =
    item.status === "passed" ? (
      <StatusPill tone="success" icon={Check} size="sm">
        Passed
      </StatusPill>
    ) : item.status === "not-passed" ? (
      <StatusPill tone="danger" icon={X} size="sm">
        Not passed
      </StatusPill>
    ) : warnings > 0 ? (
      <StatusPill
        tone="warn"
        icon={TriangleAlert}
        size="sm"
        title={`${warnings} warning${warnings > 1 ? "s" : ""}`}
      >
        {warnings}
      </StatusPill>
    ) : item.status === "in-progress" ? (
      <StatusPill tone="brand" icon={CircleDot} size="sm">
        Now
      </StatusPill>
    ) : null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: a draggable bar holds a two-line title and a pill, which a <button> can't lay out as a grid item.
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      aria-pressed={selected}
      aria-label={`${item.code} ${item.title}, ${item.credits} hp, ${item.mandatory ? "mandatory" : "elective"}, ${status}${warnings ? `, ${warnings} warning${warnings > 1 ? "s" : ""}` : ""}`}
      title={`${status}${item.pace ? ` · ${item.pace} % pace` : ""}`}
      style={{ gridColumn: `${col} / span ${span}` }}
      className={cn(
        "group relative flex min-h-[76px] cursor-grab flex-col gap-1.5 self-start rounded-[12px] border bg-cc-surface px-3 py-2.5 text-left outline-none transition-[box-shadow,border-color,transform] duration-150 active:cursor-grabbing",
        "hover:-translate-y-px hover:shadow-[0_8px_20px_-12px_rgba(20,30,45,0.4)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "focus-visible:ring-[3px] focus-visible:ring-cc-focus/40",
        item.status === "not-passed"
          ? "border-cc-danger-tint-border border-dashed"
          : warnings > 0
            ? "border-cc-warn-border"
            : item.status === "in-progress"
              ? "border-cc-brand/35"
              : "border-cc-rule2",
        selected && "ring-[3px] ring-cc-focus/35",
        continuesLeft && "rounded-l-[4px]",
        continuesRight && "rounded-r-[4px]",
        className,
      )}
    >
      <span className="flex min-h-[19px] items-center justify-between gap-2">
        <span className="truncate font-mono text-[11.5px] text-cc-brand">
          {item.code}
        </span>
        {pill}
      </span>
      <span className="line-clamp-2 text-[12.5px] text-cc-ink leading-snug">
        {item.title}
      </span>
      {/* Credits and pace on their own line, so a narrow period never truncates the code. */}
      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-[11.5px] text-cc-muted tabular-nums">
          {item.credits.toLocaleString("sv-SE")} hp
          {item.pace ? ` · ${item.pace} % pace` : ""}
        </span>
        {/* Whether the syllabus requires the course or the student chose it. */}
        {item.mandatory ? (
          <StatusPill tone="neutral" size="sm">
            Mandatory
          </StatusPill>
        ) : (
          <StatusPill tone="outline" size="sm">
            Elective
          </StatusPill>
        )}
      </span>
    </div>
  );
}
