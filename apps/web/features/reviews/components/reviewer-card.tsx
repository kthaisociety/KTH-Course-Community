"use client";

import { ArrowRight, CircleAlert } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  EXAMINATION_DISTRIBUTION_LABELS,
} from "@/types";
import {
  EXAMINATION_COLORS,
  EXAMINATION_INK,
} from "../lib/examination-palette";
import {
  APPROACH_MAX,
  APPROACH_MIDPOINT,
  APPROACH_MIN,
  dividerPositions,
  type ExaminationKey,
  isAnswered,
  MIN_SHARE,
  moveDivider,
  nudgeDivider,
  type ReviewDraft,
  toggleMethod,
} from "../lib/review-draft";
import {
  APPLIED_FILL,
  ScoreSlider,
  UNSET_FILL,
  ValuePill,
} from "./score-controls";

/** Below this share a segment is too narrow to hold its own category name. */
const LABEL_WIDTH_THRESHOLD = 24;
/**
 * Below *this* it cannot hold anything at all.
 *
 * Between the two the artboard prints an abbreviation — "Assign.", "Project" —
 * from a `short` field on its own `METHODS`. The repo's labels have no such
 * field, and inventing one would put a second name for every examination
 * category in the codebase for the sake of nine pixels. The share itself is a
 * better use of the room: it is the one thing the segment is actually saying,
 * and it is what `examinationSegments` already prints on the published card.
 */
const PERCENT_WIDTH_THRESHOLD = 13;

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-cc-rule bg-cc-pg px-4 pt-[15px] pb-3.5">
      {children}
    </div>
  );
}

function Divider() {
  return <div aria-hidden className="my-3.5 h-px bg-cc-pill" />;
}

export interface ReviewerCardCourse {
  courseCode: string;
  /** The catalogue title, once `course.summary` has answered for it. */
  name?: string | null;
  /** "7.5 hp · 2025", or whatever the screen knows about this row. */
  meta?: string | null;
}

export interface ReviewerCardProps {
  course: ReviewerCardCourse;
  draft: ReviewDraft;
  /** "3 more after this" — the artboard's `revStackLabel`. */
  stackLabel: string;
  /** Whether this is the last card, which changes the save button's wording. */
  isLast: boolean;
  isSaving: boolean;
  /** The last save's failure, still on screen with the answers it could not send. */
  saveError: string | null;
  onDraftChange: (draft: ReviewDraft) => void;
  onSkip: () => void;
  onSave: () => void;
}

/**
 * One course's card in the fast-track reviewer —
 * `docs/design_ref/2026-09-06/Course Community - Taken Courses.dc.html`, its
 * `revActive` branch.
 *
 * The card is presentation and nothing else. It edits a `ReviewDraft` and hands
 * it back; it holds no mutation, decides nothing about whether a review may be
 * written, and cannot save anything by itself. `Reviewer` owns the queue and
 * the write, which goes through `useAddReview` like every other review in the
 * app — see the note there.
 *
 * Four questions, and every one of them may be left alone. Only `happyTook` and
 * the two scores gate the save button, because those are the three
 * `reviewInputSchema` requires; an untouched examination bar or theory track is
 * the "I don't remember" answer and stores `null`.
 */
export function ReviewerCard({
  course,
  draft,
  stackLabel,
  isLast,
  isSaving,
  saveError,
  onDraftChange,
  onSkip,
  onSave,
}: Readonly<ReviewerCardProps>) {
  const examTrackRef = useRef<HTMLDivElement>(null);
  /**
   * The divider being dragged, with the bar's geometry and the draft as it was
   * when the drag started. Only segments `index` and `index + 1` move, so that
   * starting draft stays a correct base for every step — recomputing from the
   * live one would compound rounding as the pointer moves.
   */
  const drag = useRef<{ index: number; rect: DOMRect; from: ReviewDraft }>(
    null,
  );
  const answered = isAnswered(draft);
  const cuts = dividerPositions(draft);

  function patch(changes: Partial<ReviewDraft>) {
    onDraftChange({ ...draft, ...changes });
  }

  /**
   * Pointer capture rather than listeners on `window`: the divider keeps
   * receiving moves once the pointer leaves it, which is the whole reason a
   * drag needs the document, and React tears the handlers down with the card.
   * A window listener would outlive an unmount that happened mid-drag.
   */
  function startDividerDrag(
    event: React.PointerEvent<HTMLDivElement>,
    index: number,
  ) {
    const track = examTrackRef.current;
    if (!track) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { index, rect: track.getBoundingClientRect(), from: draft };
  }

  function moveDividerDrag(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current === null) return;
    const percent =
      ((event.clientX - current.rect.left) / current.rect.width) * 100;
    onDraftChange(moveDivider(current.from, current.index, percent));
  }

  return (
    <div className="@container relative z-[3] rounded-[16px] border border-cc-rule2 bg-cc-surface shadow-[0_14px_34px_rgba(20,30,45,0.09)]">
      <div className="flex items-start gap-3.5 rounded-t-[16px] border-cc-warn-border border-b bg-cc-warn px-[22px] pt-5 pb-[17px] @max-[420px]:px-4">
        <div className="min-w-0 flex-1">
          <p className="m-0 font-medium font-mono text-[12.5px] text-cc-brand">
            {course.courseCode}
          </p>
          <h3 className="m-0 mt-1.5 font-semibold text-[20px] leading-[1.25]">
            {course.name || course.courseCode}
          </h3>
          {course.meta ? (
            <p className="m-0 mt-[5px] text-[12.5px] text-cc-dim">
              {course.meta}
            </p>
          ) : null}
        </div>
        <span className="flex-none rounded-full border border-cc-warn-border bg-cc-surface px-[11px] py-1 font-medium text-[11.5px] text-cc-warn-ink tabular-nums">
          {stackLabel}
        </span>
      </div>

      <div className="flex flex-col gap-3.5 px-[22px] pt-4 pb-[18px] @max-[420px]:px-4">
        <Section>
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="font-semibold text-[14.5px]">
              How was it examined?
            </span>
            <ValuePill>
              {draft.methods.length === 0
                ? "Not set"
                : draft.methods.length === 1
                  ? "1 format"
                  : `${draft.methods.length} formats`}
            </ValuePill>
          </div>

          <div className="mt-[11px] flex flex-wrap gap-1.5">
            {EXAMINATION_DISTRIBUTION_KEYS.map((key) => {
              const picked = draft.methods.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => onDraftChange(toggleMethod(draft, key))}
                  className={cn(
                    "flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[15px] border px-[11px] text-[12.5px]",
                    picked
                      ? "border-cc-brand bg-cc-pill text-cc-ink"
                      : "border-cc-rule3 bg-cc-surface text-cc-muted hover:border-cc-brand",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2 flex-none rounded-[2px]"
                    style={{
                      background: picked ? EXAMINATION_COLORS[key] : UNSET_FILL,
                    }}
                  />
                  {EXAMINATION_DISTRIBUTION_LABELS[key]}
                </button>
              );
            })}
          </div>

          <div
            ref={examTrackRef}
            className="relative mt-[11px] flex h-[38px] select-none overflow-hidden rounded-[8px] bg-cc-pill"
          >
            {draft.methods.length === 0 ? (
              <p className="m-0 flex flex-1 items-center justify-center text-[12px] text-cc-dim">
                Click the formats this course used
              </p>
            ) : (
              draft.methods.map((key, index) => (
                <div
                  key={key}
                  className="flex items-center justify-center overflow-hidden whitespace-nowrap font-semibold text-[12px]"
                  style={{
                    width: `${draft.shares[index]}%`,
                    background: EXAMINATION_COLORS[key],
                    color: EXAMINATION_INK[key],
                  }}
                >
                  {draft.shares[index] >= LABEL_WIDTH_THRESHOLD
                    ? EXAMINATION_DISTRIBUTION_LABELS[key]
                    : draft.shares[index] >= PERCENT_WIDTH_THRESHOLD
                      ? `${draft.shares[index]}%`
                      : ""}
                </div>
              ))
            )}
            {cuts.map((cut, index) => (
              <div
                key={`${draft.methods[index]}-divider`}
                role="slider"
                tabIndex={0}
                aria-label={`Share between ${EXAMINATION_DISTRIBUTION_LABELS[draft.methods[index] as ExaminationKey]} and ${EXAMINATION_DISTRIBUTION_LABELS[draft.methods[index + 1] as ExaminationKey]}`}
                aria-valuemin={MIN_SHARE}
                aria-valuemax={100 - MIN_SHARE}
                aria-valuenow={cut}
                onPointerDown={(event) => startDividerDrag(event, index)}
                onPointerMove={moveDividerDrag}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    onDraftChange(nudgeDivider(draft, index, -1));
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    onDraftChange(nudgeDivider(draft, index, 1));
                  }
                }}
                className="-ml-[9px] absolute top-0 bottom-0 flex w-[18px] cursor-ew-resize items-center justify-center"
                style={{ left: `${cut}%` }}
              >
                <div className="h-6 w-1 rounded-[2px] bg-cc-surface shadow-[0_0_0_1px_rgba(20,30,45,0.18)]" />
              </div>
            ))}
          </div>

          <Divider />

          <div className="flex items-baseline justify-between gap-2.5">
            <span className="font-semibold text-[14.5px]">
              What was the approach?
            </span>
            <ValuePill>
              {draft.approachTheoryPercent === null
                ? "Not set"
                : `${draft.approachTheoryPercent} / ${100 - draft.approachTheoryPercent}`}
            </ValuePill>
          </div>
          <div className="relative mt-[11px] flex h-[38px] select-none overflow-hidden rounded-[8px] bg-cc-pill">
            <div
              className="flex h-full items-center overflow-hidden whitespace-nowrap pl-[11px] font-semibold text-[12px]"
              style={{
                width: `${draft.approachTheoryPercent ?? APPROACH_MIDPOINT}%`,
                background:
                  draft.approachTheoryPercent === null
                    ? UNSET_FILL
                    : "var(--cc-btn)",
                color:
                  draft.approachTheoryPercent === null
                    ? "var(--cc-dim)"
                    : "var(--cc-btn-fg)",
              }}
            >
              Theoretical
            </div>
            <div
              className="flex h-full items-center justify-end overflow-hidden whitespace-nowrap pr-[11px] font-semibold text-[12px]"
              style={{
                width: `${100 - (draft.approachTheoryPercent ?? APPROACH_MIDPOINT)}%`,
                background:
                  draft.approachTheoryPercent === null
                    ? UNSET_FILL
                    : APPLIED_FILL,
                color:
                  draft.approachTheoryPercent === null
                    ? "var(--cc-dim)"
                    : "var(--cc-brand)",
              }}
            >
              Applied
            </div>
            {/*
              The artboard draws a grab handle on the boundary, the same one the
              examination bar has, so the track reads as something you drag
              rather than as a two-tone label. It is decoration over the range
              input below, which is what actually moves.
            */}
            <div
              aria-hidden
              className="-ml-[9px] absolute top-0 bottom-0 flex w-[18px] items-center justify-center"
              style={{
                left: `${draft.approachTheoryPercent ?? APPROACH_MIDPOINT}%`,
              }}
            >
              <div className="h-6 w-1 rounded-[2px] bg-cc-surface shadow-[0_0_0_1px_rgba(20,30,45,0.18)]" />
            </div>
            <input
              type="range"
              min={APPROACH_MIN}
              max={APPROACH_MAX}
              step={1}
              value={draft.approachTheoryPercent ?? APPROACH_MIDPOINT}
              aria-label="How theoretical rather than applied the course was"
              aria-valuetext={
                draft.approachTheoryPercent === null
                  ? "Not set"
                  : `${draft.approachTheoryPercent} percent theoretical`
              }
              onChange={(event) =>
                patch({ approachTheoryPercent: Number(event.target.value) })
              }
              onPointerUp={(event) =>
                patch({
                  approachTheoryPercent: Number(event.currentTarget.value),
                })
              }
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </div>
        </Section>

        <Section>
          <ScoreSlider
            label="How demanding was this course?"
            value={draft.workloadScore}
            minLabel="Not at all"
            maxLabel="Very"
            onChange={(next) => patch({ workloadScore: next })}
          />
          <Divider />
          <ScoreSlider
            label="How much did you learn?"
            value={draft.learningScore}
            minLabel="Nothing new"
            maxLabel="Transformative"
            onChange={(next) => patch({ learningScore: next })}
          />
        </Section>

        <Section>
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="font-semibold text-[14.5px]">
              Are you happy you took this course?
            </span>
            {draft.happyTook === null && <ValuePill>Not set</ValuePill>}
          </div>
          <div className="mt-2.5 flex gap-2 @max-[420px]:flex-col">
            {[
              { value: true, label: "Yes, I am" },
              { value: false, label: "No, not really" },
            ].map((option) => {
              const picked = draft.happyTook === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => patch({ happyTook: option.value })}
                  className={cn(
                    "flex h-10 flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-[9px] border text-[13.5px] hover:border-cc-brand",
                    picked
                      ? "border-cc-brand bg-cc-pill font-semibold text-cc-brand"
                      : "border-cc-rule3 bg-cc-surface font-medium text-cc-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-[15px] flex-none rounded-full border",
                      picked
                        ? "border-cc-brand bg-cc-brand"
                        : "border-cc-rule3",
                    )}
                  />
                  {option.label}
                </button>
              );
            })}
          </div>

          <Divider />

          <label
            htmlFor={`reviewer-note-${course.courseCode}`}
            className="font-semibold text-[14.5px]"
          >
            One line for the next student
          </label>
          {/*
            The artboard says "later from the course page". There is no course
            page: `/course/<code>` is being retired and every course opens in
            the workspace pane instead, so the sentence keeps its promise and
            drops the noun that no longer names anything.
          */}
          <p className="m-0 mt-[3px] text-[12px] text-cc-muted">
            Optional. You can write the full review later from the course.
          </p>
          <textarea
            id={`reviewer-note-${course.courseCode}`}
            value={draft.message}
            onChange={(event) => patch({ message: event.target.value })}
            placeholder="What should they know before signing up?"
            className="mt-2.5 block min-h-[74px] w-full resize-y rounded-[10px] border border-cc-rule3 bg-cc-surface p-3 text-[13.5px] text-cc-ink2 leading-[1.55] outline-none"
          />
        </Section>
      </div>

      {saveError ? (
        <p
          role="alert"
          className="mx-[22px] mt-0 mb-1 flex items-center gap-2.5 rounded-[10px] border border-cc-danger-tint-border bg-cc-danger-tint px-[13px] py-[11px] text-[12.5px] text-cc-danger-ink2 leading-[1.45] @max-[420px]:mx-4"
        >
          <CircleAlert
            size={15}
            strokeWidth={2}
            aria-hidden
            className="flex-none text-cc-danger-ink"
          />
          <span className="min-w-0 flex-1">{saveError}</span>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex-none cursor-pointer font-semibold text-[12.5px] text-cc-danger-ink hover:underline"
          >
            Try again
          </button>
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-cc-rule border-t px-[22px] py-3.5 @max-[420px]:px-4">
        <button
          type="button"
          onClick={onSkip}
          disabled={isSaving}
          className="cursor-pointer font-medium text-[13px] text-cc-muted hover:underline"
        >
          Skip for now
        </button>
        <div className="flex items-center gap-[13px]">
          <span className="text-[11.5px] text-cc-dim2 @max-[560px]:hidden">
            {answered
              ? "Marks this course reviewed"
              : /*
                  The artboard's own hint here is "Answer one thing to save",
                  which its own `cardAnswered` contradicts three lines later —
                  that wants all three. Saying which three is the smaller edit
                  than shipping copy that sends a reviewer looking for the one
                  answer that unlocks the button.
                */
                "Answer happy, workload and learning to save"}
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={!answered || isSaving}
            title={
              answered
                ? undefined
                : "Answer happy, workload and learning to save — the write-up is the only optional part"
            }
            className={cn(
              "flex h-10 items-center gap-2 rounded-[9px] px-[18px] font-semibold text-[13.5px]",
              answered && !isSaving
                ? "cursor-pointer bg-cc-btn text-cc-btn-fg hover:opacity-[0.88]"
                : "cursor-not-allowed bg-cc-pill text-cc-dim",
            )}
          >
            {isSaving
              ? "Saving…"
              : isLast
                ? "Save and finish"
                : "Save and next"}
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
