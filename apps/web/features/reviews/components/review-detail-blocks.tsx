import { Kicker } from "@/components/ui/kicker";
import { cn } from "@/lib/utils";
import type { Review } from "@/types";
import { MAX_REVIEW_SCORE } from "@/types";
import {
  examinationSegments,
  examinationSplitLabel,
} from "../lib/examination-palette";

/**
 * A stored review, read back.
 *
 * Two surfaces do that and they are not the same component: the Review Card
 * expands into these blocks under its excerpt, and My Page's review detail
 * gives them a page of their own. The artboards draw one set of blocks for
 * both — `Course Community - Review Card.dc.html` and the review detail in
 * `Course Community - My Page.dc.html` are the same cards at two widths — so
 * they are written once here.
 *
 * Read-only, and no judgement about who is looking. Editing the same answers is
 * `review-draft-editor.tsx`, which is a different shape for a different job:
 * this draws what was stored, that drives what will be.
 */

/**
 * What a reviewer who answered "I don't remember" gets drawn in place of a
 * chart. Copy from the review detail in
 * `docs/design_ref/2026-09-06/Course Community - My Page.dc.html`, with its
 * "student" changed to the reviewer, who is the one person the sentence is
 * actually about.
 */
const UNANSWERED_NOTE =
  "The reviewer chose “I don't remember” — nothing is estimated in its place.";

/** The dashed panel that stands in for a chart nobody answered. */
export function UnansweredPanel() {
  return (
    <div className="mt-[11px] flex min-h-[38px] items-center rounded-lg border border-cc-rule3 border-dashed bg-cc-surface px-[13px] py-2 text-[12.5px] text-cc-dim">
      {UNANSWERED_NOTE}
    </div>
  );
}

type SectionHeadProps = {
  title: string;
  /** The pill beside the heading; "Not recorded" when there is no answer. */
  value: string;
  className?: string;
};

/** A detail block's heading and the figure that goes with it. */
export function SectionHead({
  title,
  value,
  className,
}: Readonly<SectionHeadProps>) {
  return (
    <div
      className={cn("flex items-baseline justify-between gap-2.5", className)}
    >
      <div className="font-semibold text-[14.5px]">{title}</div>
      <div className="flex-none rounded-full bg-cc-pill px-[9px] py-0.5 font-semibold text-[12px] text-cc-brand tabular-nums">
        {value}
      </div>
    </div>
  );
}

type MeterProps = {
  label: string;
  score: number;
  low: string;
  high: string;
};

/**
 * One 1-10 axis. Scores are displayed raw — a 7 is "7 / 10" and fills 70% of
 * the track. Nothing is rescaled to five (issue #68, decision 2).
 */
export function Meter({ label, score, low, high }: Readonly<MeterProps>) {
  return (
    <div>
      <SectionHead
        title={label}
        value={`${score} / ${MAX_REVIEW_SCORE}`}
        className="mb-[9px]"
      />
      <div className="h-2 w-full overflow-hidden rounded-[4px] bg-cc-rule">
        <div
          className="h-full bg-cc-btn"
          style={{ width: `${(score / MAX_REVIEW_SCORE) * 100}%` }}
        />
      </div>
      <div className="mt-[5px] flex justify-between text-[11.5px] text-cc-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

type ExaminationBlockProps = Pick<
  Review,
  "examinationDistribution" | "approachTheoryPercent"
>;

/**
 * How a course was examined and how theoretical it was — the "Format" card.
 *
 * Both halves can be absent, and each says so on its own: a reviewer who
 * remembered the split but not the approach gets a bar and a dashed note, not
 * one blanket apology for the pair.
 */
export function ExaminationBlock({
  examinationDistribution,
  approachTheoryPercent,
}: Readonly<ExaminationBlockProps>) {
  const segments = examinationSegments(examinationDistribution);
  const splitLabel = examinationSplitLabel(examinationDistribution);

  return (
    <>
      <Kicker>Format</Kicker>
      <SectionHead
        title="How it was examined"
        value={splitLabel ?? "Not recorded"}
        className="mt-1.5"
      />
      {segments.length > 0 ? (
        <div className="mt-[11px] flex h-[38px] overflow-hidden rounded-lg bg-cc-rule">
          {segments.map((segment) => (
            <div
              key={segment.key}
              className="flex items-center justify-center overflow-hidden whitespace-nowrap font-semibold text-[12px]"
              style={{
                width: `${segment.percent}%`,
                background: segment.color,
                color: segment.ink,
              }}
            >
              {segment.label}
            </div>
          ))}
        </div>
      ) : (
        <UnansweredPanel />
      )}

      <div className="my-3.5 h-px bg-cc-rule" />

      <SectionHead
        title="The approach"
        value={
          approachTheoryPercent === null
            ? "Not recorded"
            : `${approachTheoryPercent} / ${100 - approachTheoryPercent}`
        }
      />
      {approachTheoryPercent === null ? (
        <UnansweredPanel />
      ) : (
        <div className="mt-[11px] flex h-[38px] overflow-hidden rounded-lg bg-cc-rule">
          <div
            className="flex items-center overflow-hidden whitespace-nowrap bg-cc-btn pl-[11px] font-semibold text-[12px] text-cc-btn-fg"
            style={{ width: `${approachTheoryPercent}%` }}
          >
            Theoretical
          </div>
          <div
            className="flex items-center justify-end overflow-hidden whitespace-nowrap bg-cc-info pr-[11px] font-semibold text-[12px] text-cc-brand"
            style={{ width: `${100 - approachTheoryPercent}%` }}
          >
            Applied
          </div>
        </div>
      )}
    </>
  );
}

type ProfileBlockProps = Pick<Review, "workloadScore" | "learningScore">;

/** The two 1-10 axes — the "Course profile" card. */
export function ProfileBlock({
  workloadScore,
  learningScore,
}: Readonly<ProfileBlockProps>) {
  return (
    <>
      <Kicker>Course profile</Kicker>
      <Meter
        label="How demanding it was"
        score={workloadScore}
        low="Not at all"
        high="Very"
      />
      <Meter
        label="How much was learned"
        score={learningScore}
        low="Nothing new"
        high="Transformative"
      />
    </>
  );
}
