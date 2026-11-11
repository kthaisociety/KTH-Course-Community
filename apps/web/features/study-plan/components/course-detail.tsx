"use client";

import { ExternalLink, Info, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PlanItem } from "../lib/build-plan";
import type { CheckFix, PlanCheck } from "../lib/check-plan";
import { type Slot, slotIndex, slotLabel } from "../lib/slots";
import type { SlotOption } from "./course-tray";

type Props = {
  item: PlanItem;
  checks: PlanCheck[];
  options: SlotOption[];
  signedIn: boolean;
  onClose: () => void;
  onMove: (slot: Slot) => void;
  onFix: (check: PlanCheck, fix: CheckFix) => void;
  onDismiss: (check: PlanCheck) => void;
  onLeaveOut: () => void;
  onRemove: () => void;
  onResetSlot: () => void;
  onMarkPassed: () => void;
};

const SOURCE: Record<PlanItem["roundSource"], string> = {
  programme: "your programme's schedule this academic year",
  master: "your master's schedule this academic year",
  kth: "this year's rounds on the course's kth.se page",
  catalogue: "the catalogue's 2025/26 rounds",
  none: "no round data",
};

/** The selected course: where it sits, why, its checks with their fixes, and what you can do with it. */
export function CourseDetail({
  item,
  checks,
  options,
  signedIn,
  onClose,
  onMove,
  onFix,
  onDismiss,
  onLeaveOut,
  onRemove,
  onResetSlot,
  onMarkPassed,
}: Props) {
  const status =
    item.status === "passed"
      ? `Passed${item.taken?.grade ? ` · grade ${item.taken.grade}` : ""}`
      : item.status === "not-passed"
        ? "Not passed — not in your transcript"
        : item.status === "in-progress"
          ? "In progress"
          : item.status === "unplaced"
            ? "Passed, period not set"
            : "Planned";
  const periods = item.segments
    .map(
      (s) =>
        `${slotLabel(s.slot)} (${s.credits.toLocaleString("sv-SE")} hp${s.continued ? ", continues" : ""})`,
    )
    .join(" · ");
  const current = item.slot
    ? (options.find((o) => slotIndex(o.slot) === slotIndex(item.slot as Slot))
        ?.value ?? "")
    : "";
  return (
    <section
      aria-label={`${item.code} in your plan`}
      className="rounded-[14px] border border-cc-rule bg-cc-surface px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[12px] text-cc-brand">{item.code}</div>
          <h3 className="font-semibold text-[15px] text-cc-ink leading-snug">
            {item.title}
          </h3>
          <p className="text-[12.5px] text-cc-muted">{status}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-cc-muted hover:bg-cc-pill"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
        <dt className="text-cc-muted">Credits</dt>
        <dd className="text-cc-ink">
          {item.credits.toLocaleString("sv-SE")} hp ·{" "}
          {item.level === "A"
            ? "advanced"
            : item.level === "P"
              ? "preparatory"
              : "basic"}{" "}
          level
          {item.mandatory
            ? " · mandatory"
            : item.category
              ? ` · ${item.category === "VV" ? "conditionally elective" : "elective"}`
              : ""}
        </dd>
        {item.segments.length ? (
          <>
            <dt className="text-cc-muted">Periods</dt>
            <dd className="text-cc-ink">{periods}</dd>
            <dt className="text-cc-muted">Pace</dt>
            <dd className="text-cc-ink">
              {item.pace ? `${item.pace} %` : "—"}, from{" "}
              {SOURCE[item.roundSource]}
            </dd>
          </>
        ) : null}
        {item.offeredStarts.length ? (
          <>
            <dt className="text-cc-muted">Given in</dt>
            <dd className="text-cc-ink">
              {item.offeredStarts
                .map((p) => (p === 5 ? "summer" : `P${p}`))
                .join(", ")}
            </dd>
          </>
        ) : null}
      </dl>

      {checks.map((c) => (
        <div
          key={c.key}
          className={cn(
            "mt-3 rounded-[10px] border px-3 py-2.5",
            c.severity === "warning"
              ? "border-cc-warn-border bg-cc-warn"
              : "border-cc-rule bg-cc-inset",
          )}
        >
          <div className="flex gap-2 text-[12.5px] text-cc-ink">
            {c.severity === "warning" ? (
              <TriangleAlert
                aria-hidden
                size={14}
                className="mt-[2px] shrink-0 text-cc-warn-ink"
              />
            ) : (
              <Info
                aria-hidden
                size={14}
                className="mt-[2px] shrink-0 text-cc-dim"
              />
            )}
            <span>{c.message}</span>
          </div>
          {c.evidence ? (
            <blockquote className="mt-1.5 border-cc-rule2 border-l-2 pl-2.5 text-[12px] text-cc-muted">
              {c.evidence.text}
              <cite className="mt-0.5 block not-italic text-[11px]">
                {c.evidence.source}
              </cite>
            </blockquote>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.fixes.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => onFix(c, f)}
                className="h-7 cursor-pointer rounded-[8px] border border-cc-rule2 bg-cc-surface px-2.5 text-[12px] text-cc-ink hover:bg-cc-pill"
              >
                {f.label}
              </button>
            ))}
            {c.severity === "warning" && c.code ? (
              <button
                type="button"
                onClick={() => onDismiss(c)}
                className="h-7 cursor-pointer rounded-[8px] px-2.5 text-[12px] text-cc-muted hover:bg-cc-pill"
              >
                I've checked this
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {options.length ? (
        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="sp-move" className="text-[12px] text-cc-muted">
            {item.slot ? "Move to" : "Place in"}
          </label>
          <select
            id="sp-move"
            value={current}
            onChange={(e) => {
              const o = options.find((x) => x.value === e.target.value);
              if (o) onMove(o.slot);
            }}
            className="h-9 w-full cursor-pointer rounded-[10px] border border-cc-rule2 bg-cc-surface px-2.5 text-[13px] text-cc-ink"
          >
            {item.slot ? null : <option value="">Choose a period</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {item.slot ? (
            <p className="text-[11.5px] text-cc-muted">
              With the course selected, ← and → move it a period.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Link
          href={`/search?open=${encodeURIComponent(item.code)}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-cc-btn px-3 font-medium text-[12.5px] text-cc-btn-fg"
        >
          <ExternalLink aria-hidden size={13} /> Course details
        </Link>
        {item.status === "passed" && signedIn ? (
          <Link
            href={`/search?open=${encodeURIComponent(item.code)}&kind=review`}
            className="inline-flex h-8 items-center rounded-[8px] border border-cc-rule2 px-3 text-[12.5px] text-cc-ink hover:bg-cc-pill"
          >
            Review it
          </Link>
        ) : null}
        {item.status === "not-passed" && signedIn ? (
          <button
            type="button"
            onClick={onMarkPassed}
            className="h-8 cursor-pointer rounded-[8px] border border-cc-rule2 px-3 text-[12.5px] text-cc-ink hover:bg-cc-pill"
          >
            I passed it
          </button>
        ) : null}
        {item.placedByStudent && item.source !== "own" ? (
          <button
            type="button"
            onClick={onResetSlot}
            className="h-8 cursor-pointer rounded-[8px] border border-cc-rule2 px-3 text-[12.5px] text-cc-ink hover:bg-cc-pill"
          >
            Back to the syllabus period
          </button>
        ) : null}
        {item.source === "own" && item.taken && item.slot ? (
          <button
            type="button"
            onClick={onRemove}
            className="h-8 cursor-pointer rounded-[8px] border border-cc-rule2 px-3 text-[12.5px] text-cc-ink hover:bg-cc-pill"
          >
            Back to “To place”
          </button>
        ) : null}
        {item.source === "own" && !item.taken ? (
          <button
            type="button"
            onClick={onRemove}
            className="h-8 cursor-pointer rounded-[8px] border border-cc-rule2 px-3 text-[12.5px] text-cc-ink hover:bg-cc-pill"
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeaveOut}
            className="h-8 cursor-pointer rounded-[8px] border border-cc-rule2 px-3 text-[12.5px] text-cc-ink hover:bg-cc-pill"
          >
            Don't include
          </button>
        )}
      </div>
    </section>
  );
}
