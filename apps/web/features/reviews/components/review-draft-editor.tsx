"use client";

import { useRef } from "react";
import { Kicker } from "@/components/ui/kicker";
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
  MIN_SHARE,
  moveDivider,
  nudgeDivider,
  toggleMethod,
} from "../lib/review-answers";
import type { ReviewDraft } from "../lib/review-draft";
import {
  APPLIED_FILL,
  ScoreSlider,
  UNSET_FILL,
  ValuePill,
} from "./score-controls";

/** How the design starts a review for someone staring at an empty box. */
const PROMPTS = [
  ["What surprised you?", "One thing that surprised me was "],
  ["Who is it for?", "This course is a great fit if you "],
  ["Time it really took?", "Budget more time than you think for "],
] as const;

/**
 * The theory/applied track moves in whole five-point steps, as the artboard's
 * does. It is its own constant rather than the examination bar's `MIN_SHARE`,
 * which is the same number and answers a different question — the smallest a
 * *segment* may be dragged to.
 */
const APPROACH_STEP = 5;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-cc-rule bg-cc-pg p-4">
      {children}
    </div>
  );
}

function ForgotCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <label className="mt-[9px] flex w-fit items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={onToggle}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          /*
            **Do not remove this ring as a duplicate of `globals.css`'s.** Most
            hand-rolled focus treatments in `features/**` are redundant against
            the global `:focus-visible` rule. This one is not, and the reason is
            not visible from the class list.

            The focusable element here is the `peer` input above, which is
            `sr-only` — clipped to a 1px box. The global rule draws its outline
            and halo on *that*, where nothing can see them. This ring is painted
            on a sibling that is never itself `:focus-visible`, so the global
            rule does not reach it and does not override it. Delete it and the
            checkbox has no visible focus indicator at all.
          */
          "flex size-4 flex-none items-center justify-center rounded-[4px] border text-[10px] peer-focus-visible:ring-2 peer-focus-visible:ring-cc-hov",
          checked
            ? "border-cc-brand bg-cc-brand text-cc-btn-fg"
            : "border-cc-rule3",
        )}
      >
        {checked ? "✓" : ""}
      </span>
      <span className="text-[12.5px] text-cc-ink2">I don't remember</span>
    </label>
  );
}

export interface ReviewDraftEditorProps {
  draft: ReviewDraft;
  /**
   * Every keystroke, drag and tick. The host decides what that means: the
   * workspace pane mirrors it into `localStorage`, My Page holds it until the
   * writer saves, and either may ignore a change outright — a panel that has
   * just published stops taking edits by handing over an `onChange` that does
   * nothing.
   */
  onChange: (draft: ReviewDraft) => void;
}

/**
 * The three cards a review is written in: how it was examined and how
 * theoretical it was, the two 1–10 scores, and the verdict with the write-up.
 *
 * Presentation and arithmetic, and nothing else — no session, no mutation, no
 * storage. It takes a draft and reports a new one, which is what lets two very
 * different hosts draw the same form: the workspace pane wraps it in a progress
 * header, a sign-in dance and a Post button, and My Page's review detail wraps
 * it in a course header and a Save button. Whatever either of them does next,
 * `toReviewFormData` is the only way this shape becomes something writable.
 *
 * The bar transforms are the shared ones from `lib/review-answers.ts`. Nothing
 * about a host makes a divider move differently, and this component owns no
 * copy of them.
 */
export function ReviewDraftEditor({
  draft,
  onChange,
}: Readonly<ReviewDraftEditorProps>) {
  const examTrackRef = useRef<HTMLDivElement>(null);
  const cuts = dividerPositions(draft);
  const examDisabled = draft.examinationForgotten;
  const approachDisabled = draft.approachForgotten;

  function patch(changes: Partial<ReviewDraft>) {
    onChange({ ...draft, ...changes });
  }

  function startDividerDrag(
    event: React.PointerEvent<HTMLElement>,
    index: number,
  ) {
    const track = examTrackRef.current;
    if (!track) return;
    event.preventDefault();
    const rect = track.getBoundingClientRect();
    // Only segments `index` and `index + 1` move, so the draft captured here
    // stays a correct base for every step of the drag.
    const start = draft;
    const move = (moveEvent: PointerEvent) => {
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      onChange(moveDivider(start, index, percent));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <Kicker>Format</Kicker>
        <div className="mt-[5px] flex items-baseline justify-between gap-2.5">
          <span className="font-semibold text-[14.5px]">
            How was it examined?
          </span>
          {!examDisabled && (
            <ValuePill>
              {draft.methods.length > 0 ? draft.shares.join(" / ") : "Not set"}
            </ValuePill>
          )}
        </div>

        <div className="mt-[11px] flex flex-wrap gap-1.5">
          {EXAMINATION_DISTRIBUTION_KEYS.map((key) => {
            const picked = draft.methods.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={picked}
                disabled={examDisabled}
                onClick={() => onChange(toggleMethod(draft, key))}
                className={cn(
                  "flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[15px] border px-[11px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-40",
                  picked
                    ? "border-cc-brand bg-cc-pill text-cc-ink"
                    : "border-cc-rule3 bg-cc-surface text-cc-muted hover:border-cc-brand",
                )}
              >
                <span
                  aria-hidden="true"
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
          className={cn(
            "relative mt-[11px] flex h-[38px] select-none overflow-hidden rounded-[8px] bg-cc-pill",
            examDisabled && "pointer-events-none opacity-40",
          )}
        >
          {draft.methods.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-[12px] text-cc-dim">
              Click the formats this course used
            </div>
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
                {draft.shares[index] >= 24
                  ? EXAMINATION_DISTRIBUTION_LABELS[key]
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
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  onChange(nudgeDivider(draft, index, -1));
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  onChange(nudgeDivider(draft, index, 1));
                }
              }}
              className="-ml-[9px] absolute top-0 bottom-0 flex w-[18px] cursor-ew-resize items-center justify-center"
              style={{ left: `${cut}%` }}
            >
              <div className="h-6 w-1 rounded-[2px] bg-cc-surface shadow-[0_0_0_1px_rgba(20,30,45,0.18)]" />
            </div>
          ))}
        </div>

        <ForgotCheckbox
          checked={draft.examinationForgotten}
          label="I don't remember how it was examined"
          onToggle={() =>
            patch({
              examinationForgotten: !draft.examinationForgotten,
              methods: [],
              shares: [],
            })
          }
        />

        <div className="my-3.5 h-px bg-cc-pill" />

        <div className="flex items-baseline justify-between gap-2.5">
          <span className="font-semibold text-[14.5px]">
            What was the approach?
          </span>
          {!approachDisabled && (
            <ValuePill>
              {draft.approachTheoryPercent === null
                ? "Not set"
                : `${draft.approachTheoryPercent} / ${100 - draft.approachTheoryPercent}`}
            </ValuePill>
          )}
        </div>
        <div
          className={cn(
            "relative mt-[11px] flex h-[38px] select-none overflow-hidden rounded-[8px] bg-cc-pill",
            approachDisabled && "pointer-events-none opacity-40",
          )}
        >
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
          {/* The track's ends are the approach question's own, not the
              examination bar's minimum share — the two happen to be the same
              number today and mean different things. `toReviewFormData` clamps
              to exactly these, and so does `toReviewDraft` on the way back in,
              so a control bounded by anything else would let the writer set a
              value one of the mappers then quietly moved. */}
          <input
            type="range"
            min={APPROACH_MIN}
            max={APPROACH_MAX}
            step={APPROACH_STEP}
            value={draft.approachTheoryPercent ?? APPROACH_MIDPOINT}
            aria-label="How theoretical rather than applied the course was"
            aria-valuetext={
              draft.approachTheoryPercent === null
                ? "Not set"
                : `${draft.approachTheoryPercent} percent theoretical`
            }
            disabled={approachDisabled}
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
        <ForgotCheckbox
          checked={draft.approachForgotten}
          label="I don't remember the approach"
          onToggle={() =>
            patch({
              approachForgotten: !draft.approachForgotten,
              approachTheoryPercent: null,
            })
          }
        />
      </Card>

      <Card>
        <div className="mb-[11px]">
          <Kicker>Course profile</Kicker>
        </div>
        <ScoreSlider
          label="How demanding was this course?"
          value={draft.workloadScore}
          minLabel="Not at all"
          maxLabel="Very"
          onChange={(next) => patch({ workloadScore: next })}
        />
        <div className="my-3.5 h-px bg-cc-pill" />
        <ScoreSlider
          label="How much did you learn in this course?"
          value={draft.learningScore}
          minLabel="Nothing new"
          maxLabel="Transformative"
          onChange={(next) => patch({ learningScore: next })}
        />
      </Card>

      <Card>
        <Kicker>Your take</Kicker>
        <div className="mt-[5px] flex items-baseline justify-between gap-2.5">
          <span className="font-semibold text-[14.5px]">
            Are you happy you took this course?
          </span>
          {draft.happyTook === null && <ValuePill>Not set</ValuePill>}
        </div>
        <div className="mt-2.5 flex gap-2">
          {[
            { value: true, label: "Yes, I am" },
            { value: false, label: "No, I am not" },
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
                    : "border-cc-rule3 bg-cc-surface font-medium text-cc-chip-ink",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-[15px] flex-none rounded-full border",
                    picked ? "border-cc-brand bg-cc-brand" : "border-cc-rule3",
                  )}
                />
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="my-3.5 h-px bg-cc-pill" />

        <div className="font-semibold text-[14.5px]">Write your review</div>
        <p className="mt-[3px] text-[12px] text-cc-muted">
          Not sure where to start? Tap one:
        </p>
        <div className="mt-[9px] flex flex-wrap gap-1.5">
          {PROMPTS.map(([label, starter]) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                patch({
                  message: draft.message
                    ? `${draft.message.replace(/\s*$/, "")}\n${starter}`
                    : starter,
                })
              }
              className="flex h-7 cursor-pointer items-center rounded-[14px] border border-cc-hov border-dashed bg-cc-pill px-[11px] font-medium text-[11.5px] text-cc-brand"
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          value={draft.message}
          onChange={(event) => patch({ message: event.target.value })}
          aria-label="Write your review"
          placeholder="What should the next student know before signing up?"
          className="mt-2.5 block min-h-[104px] w-full resize-y rounded-[10px] border border-cc-rule3 bg-cc-surface p-3 text-[13.5px] text-cc-ink2 leading-[1.55] outline-none"
        />
        <p className="mt-1.5 text-[11.5px] text-cc-muted">
          Be constructive and respectful
        </p>
      </Card>
    </div>
  );
}
