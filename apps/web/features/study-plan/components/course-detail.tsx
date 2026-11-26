"use client";

import {
  ArrowLeftRight,
  Check,
  CircleDot,
  ExternalLink,
  EyeOff,
  Info,
  PenLine,
  Plus,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type CourseReviewStats, MAX_REVIEW_SCORE } from "@/types";
import type { PlanItem } from "../lib/build-plan";
import type { CheckFix, PlanCheck } from "../lib/check-plan";
import { type Slot, slotIndex, slotLabel, termLabel } from "../lib/slots";
import type { SlotOption } from "./course-tray";
import { PeriodStrip } from "./period-strip";
import { SlotPicker } from "./slot-picker";
import { type PillTone, StatusPill } from "./status-pill";

/** The detail's rarer actions: text with an icon, no border, so they sit under the main pair. */
const QUIET =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] text-cc-muted hover:bg-cc-pill hover:text-cc-ink";

const STATUS_TONE: Record<PlanItem["status"], PillTone> = {
  passed: "success",
  unplaced: "success",
  "not-passed": "danger",
  "in-progress": "brand",
  planned: "neutral",
};
const STATUS_ICON: Record<PlanItem["status"], typeof Check | undefined> = {
  passed: Check,
  unplaced: Check,
  "not-passed": X,
  "in-progress": CircleDot,
  planned: undefined,
};

/** One review score as the course page draws it: "8.2 / 10" over a bar in the score's own colour. */
function Score({
  label,
  mean,
  fill,
}: {
  label: string;
  mean: number;
  fill: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] text-cc-muted">{label}</span>
        <span className="font-semibold text-[13px] text-cc-ink tabular-nums">
          {mean.toFixed(1)}
          <span className="font-normal text-[11px] text-cc-muted">
            {" "}
            / {MAX_REVIEW_SCORE}
          </span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cc-pill">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(mean / MAX_REVIEW_SCORE) * 100}%`,
            background: fill,
          }}
        />
      </div>
    </div>
  );
}

type Props = {
  item: PlanItem;
  /** What students say about the course; null when nobody has reviewed it, undefined while loading. */
  reviews?: CourseReviewStats | null;
  /** The scores are on their way: hold their space rather than let the card jump when they land. */
  reviewsLoading?: boolean;
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
  /** Records the course as failed in Taken courses (a failing grade). */
  onMarkFailed: () => void;
  /** The course is in Taken courses with a failing grade or partial credits. */
  failed: boolean;
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
  onMarkFailed,
  failed,
  reviews,
  reviewsLoading = false,
}: Props) {
  const status =
    item.status === "passed"
      ? `Passed${item.taken?.grade ? ` · grade ${item.taken.grade}` : ""}`
      : item.status === "not-passed"
        ? failed
          ? "Failed"
          : "Not passed"
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
  // "VT 2027 P3–P4" rather than one label per period: the span is what matters here.
  const first = item.segments[0]?.slot;
  const last = item.segments.at(-1)?.slot;
  const placedIn =
    first && last
      ? slotLabel(first) +
        (slotIndex(last) === slotIndex(first)
          ? ""
          : termLabel(last) === termLabel(first)
            ? `–P${last.p}`
            : ` – ${slotLabel(last)}`) +
        (item.segments.some((x) => x.continued) ? ", continues" : "")
      : "";
  return (
    <section
      aria-label={`${item.code} in your plan`}
      className="rounded-[16px] border border-cc-rule bg-cc-surface px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[12px] text-cc-brand">{item.code}</div>
          <h3 className="font-semibold text-[15px] text-cc-ink leading-snug">
            {item.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill
              tone={STATUS_TONE[item.status]}
              icon={STATUS_ICON[item.status]}
            >
              {status}
            </StatusPill>
            {item.mandatory ? (
              <StatusPill tone="neutral">Mandatory</StatusPill>
            ) : (
              <StatusPill tone="outline">Elective</StatusPill>
            )}
            {/* Correct the result here: a taken course can be failed, and a failed one passed later. */}
            {signedIn &&
            (item.status === "passed" || item.status === "unplaced") ? (
              <button
                type="button"
                onClick={onMarkFailed}
                className="inline-flex h-[23px] cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] text-cc-muted ring-1 ring-cc-rule2 ring-inset hover:bg-cc-pill hover:text-cc-ink"
              >
                <X aria-hidden size={12} strokeWidth={2.6} /> Mark as failed
              </button>
            ) : null}
            {signedIn && item.status === "not-passed" ? (
              <button
                type="button"
                onClick={onMarkPassed}
                className="inline-flex h-[23px] cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] text-cc-muted ring-1 ring-cc-rule2 ring-inset hover:bg-cc-pill hover:text-cc-ink"
              >
                <Check aria-hidden size={12} strokeWidth={2.6} /> Mark as passed
              </button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-cc-muted hover:bg-cc-pill"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      {/* The facts as figures with captions: quieter than a row of chips. */}
      <dl className="mt-4 grid grid-cols-3 divide-x divide-cc-rule rounded-[12px] border border-cc-rule py-2.5 text-center">
        {[
          ["Credits", `${item.credits.toLocaleString("sv-SE")} hp`],
          [
            "Level",
            item.level === "A"
              ? "Advanced"
              : item.level === "P"
                ? "Preparatory"
                : "Basic",
          ],
          ["Pace", item.pace ? `${item.pace} %` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse gap-0.5 px-2">
            <dt className="text-[11.5px] text-cc-muted">{label}</dt>
            <dd className="font-semibold text-[14px] text-cc-ink tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {item.segments.length || item.offeredStarts.length ? (
        <div className="mt-3 flex items-end justify-between gap-3">
          {item.segments.length ? (
            <div className="min-w-0">
              <div className="text-[11.5px] text-cc-muted">In your plan</div>
              <div className="text-[13px] text-cc-ink" title={periods}>
                {placedIn}
                {item.category === "VV" ? (
                  <span className="text-cc-muted">
                    {" "}
                    · conditionally elective
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <span />
          )}
          {item.offeredStarts.length ? (
            <div className="shrink-0 text-right">
              <div className="mb-1 text-[11.5px] text-cc-muted">Given in</div>
              <PeriodStrip starts={item.offeredStarts} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* What students say, next to the facts: learning and workload as the course page draws them. */}
      {reviews ? (
        <div className="mt-4 border-cc-rule border-t pt-3.5">
          <div className="grid grid-cols-2 gap-4">
            <Score
              label="Learning"
              mean={reviews.learningMean}
              fill="var(--cc-btn)"
            />
            <Score
              label="Workload"
              mean={reviews.workloadMean}
              fill="var(--cc-score-workload)"
            />
          </div>
          <p className="mt-2.5 text-[11.5px] text-cc-muted tabular-nums">
            <b className="font-semibold text-cc-ink">
              {reviews.happyPercent} %
            </b>{" "}
            glad they took it · {reviews.reviewCount} review
            {reviews.reviewCount === 1 ? "" : "s"}
          </p>
        </div>
      ) : reviews === null ? (
        <p className="mt-4 border-cc-rule border-t pt-3 text-[12px] text-cc-muted">
          No reviews yet.
        </p>
      ) : reviewsLoading ? (
        <div aria-hidden className="mt-4 border-cc-rule border-t pt-3.5">
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="h-[18px] animate-pulse rounded-[6px] bg-cc-pill motion-reduce:animate-none" />
                <div className="mt-1.5 h-1.5 animate-pulse rounded-full bg-cc-pill motion-reduce:animate-none" />
              </div>
            ))}
          </div>
          <div className="mt-2.5 h-[15px] w-1/2 animate-pulse rounded-[6px] bg-cc-pill motion-reduce:animate-none" />
        </div>
      ) : null}

      {checks.map((c) => (
        <div
          key={c.key}
          className={cn(
            "mt-3 rounded-[12px] border px-3 py-2.5",
            c.severity === "warning"
              ? "border-cc-warn-border bg-cc-warn"
              : "border-cc-rule bg-cc-info",
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
                className="h-7 cursor-pointer rounded-full border border-cc-rule2 bg-cc-surface px-2.5 text-[12px] text-cc-ink hover:bg-cc-pill"
              >
                {f.label}
              </button>
            ))}
            {c.severity === "warning" && c.code ? (
              <button
                type="button"
                onClick={() => onDismiss(c)}
                className="h-7 cursor-pointer rounded-full px-2.5 text-[12px] text-cc-muted hover:bg-cc-pill"
              >
                I've checked this
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {/* Two even main actions, then the rarer ones as quiet text below a rule, so a
          second line reads as its own tier instead of a button that wrapped. */}
      <div className="mt-4 flex gap-1.5">
        {/* Moving is the planner's own action, so it leads; the grid it opens marks where the course sits now. */}
        {options.length ? (
          <SlotPicker
            variant="button"
            icon={item.slot ? ArrowLeftRight : Plus}
            align="start"
            options={options}
            current={item.slot}
            starts={item.offeredStarts}
            onPick={onMove}
            label={item.slot ? "Move course" : "Add to plan"}
            ariaLabel={`${item.slot ? "Move" : "Place"} ${item.code}`}
            className="h-8 flex-1 px-3 text-[12.5px]"
          />
        ) : null}
        <Link
          href={`/search?open=${encodeURIComponent(item.code)}`}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-cc-rule2 px-3 text-[12.5px] text-cc-ink hover:bg-cc-pill"
        >
          <ExternalLink aria-hidden size={13} /> Course details
        </Link>
      </div>
      {/* A passed course's own next step, full width under the pair: the review a student is best placed to write. */}
      {item.status === "passed" && signedIn ? (
        <Link
          href={`/search?open=${encodeURIComponent(item.code)}&kind=review`}
          className="mt-1.5 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-cc-rule2 text-[12.5px] text-cc-ink hover:bg-cc-pill"
        >
          <PenLine aria-hidden size={13} /> Write a review
        </Link>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-x-1 gap-y-0.5 border-cc-rule border-t pt-2">
        {/* A syllabus course goes back to its period; a course the student added can go altogether. */}
        {item.placedByStudent && item.mandatory ? (
          <button type="button" onClick={onResetSlot} className={QUIET}>
            <Undo2 aria-hidden size={13} /> Back to the syllabus period
          </button>
        ) : null}
        {item.source === "own" && item.taken && item.slot ? (
          <button type="button" onClick={onRemove} className={QUIET}>
            <Undo2 aria-hidden size={13} /> Back to “To place”
          </button>
        ) : null}
        {!item.mandatory && !item.taken ? (
          <button type="button" onClick={onRemove} className={QUIET}>
            <Trash2 aria-hidden size={13} /> Remove from plan
          </button>
        ) : (
          <button type="button" onClick={onLeaveOut} className={QUIET}>
            <EyeOff aria-hidden size={13} /> Don't include
          </button>
        )}
      </div>
    </section>
  );
}
