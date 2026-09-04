"use client";

import { useEffect, useRef, useState } from "react";
import { type AuthReason, AuthReasonDialog, useMe } from "@/features/auth";
import { useCourseDetails } from "@/features/courses";
import {
  EXAMINATION_COLORS,
  EXAMINATION_INK,
  useAddReview,
  useReviewList,
} from "@/features/reviews";
import { formatHp } from "@/lib/kth";
import { cn } from "@/lib/utils";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  EXAMINATION_DISTRIBUTION_LABELS,
  MAX_REVIEW_SCORE,
  MIN_REVIEW_SCORE,
} from "@/types";
import {
  APPROACH_MIDPOINT,
  canPublish,
  dividerPositions,
  EMPTY_REVIEW_DRAFT,
  type ExaminationKey,
  isUntouched,
  MIN_SHARE,
  moveDivider,
  nudgeDivider,
  REVIEW_DRAFT_SECTIONS,
  type ReviewDraft,
  sectionsDone,
  toggleMethod,
  toReviewInput,
} from "../lib/review-draft";
import {
  claimAwaitingSignIn,
  clearAwaitingSignIn,
  markAwaitingSignIn,
} from "../lib/workspace-storage";
import { APPLIED_FILL, Kicker } from "./pane-parts";

/** How the design starts a review for someone staring at an empty box. */
const PROMPTS = [
  ["What surprised you?", "One thing that surprised me was "],
  ["Who is it for?", "This course is a great fit if you "],
  ["Time it really took?", "Budget more time than you think for "],
] as const;

/** Unanswered tracks are drawn in the theme's strong hairline, not a fill. */
const UNSET_FILL = "var(--cc-rule3)";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-cc-rule bg-cc-pg p-4">
      {children}
    </div>
  );
}

function ValuePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex-none rounded-full bg-cc-pill px-[9px] py-0.5 font-semibold text-[12px] text-cc-brand tabular-nums">
      {children}
    </span>
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

/**
 * A 1–10 score, on the scale the database stores.
 *
 * The visible track is ours so an unanswered score can read as empty rather
 * than as 1; the range input on top of it is what a keyboard and a screen
 * reader drive. `onPointerUp` commits as well as `onChange` so that clicking
 * the value the input already holds still answers the question.
 */
function ScoreSlider({
  label,
  value,
  minLabel,
  maxLabel,
  onChange,
}: {
  label: string;
  value: number | null;
  minLabel: string;
  maxLabel: string;
  onChange: (next: number) => void;
}) {
  const percent = value === null ? 0 : (value / MAX_REVIEW_SCORE) * 100;
  return (
    <div>
      <div className="mb-[9px] flex items-baseline justify-between gap-2.5">
        <span className="font-semibold text-[14.5px]">{label}</span>
        <ValuePill>
          {value === null ? "Not set" : `${value} / ${MAX_REVIEW_SCORE}`}
        </ValuePill>
      </div>
      <div className="relative flex h-[22px] items-center">
        <div className="h-2 w-full overflow-hidden rounded-[4px] bg-cc-pill">
          <div
            className="h-full"
            style={{ width: `${percent}%`, background: "var(--cc-warn-btn)" }}
          />
        </div>
        {value !== null && (
          <div
            aria-hidden="true"
            className="-ml-2.5 absolute size-5 rounded-full border-2 border-cc-brand bg-cc-surface"
            style={{ left: `${percent}%` }}
          />
        )}
        <input
          type="range"
          min={MIN_REVIEW_SCORE}
          max={MAX_REVIEW_SCORE}
          step={1}
          value={value ?? MIN_REVIEW_SCORE}
          aria-label={label}
          aria-valuetext={value === null ? "Not set" : `${value} of 10`}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerUp={(event) => onChange(Number(event.currentTarget.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] text-cc-muted">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export interface ReviewDraftPanelProps {
  courseCode: string;
  draft: ReviewDraft;
  /**
   * The workspace sent a review for this course and has not yet seen it come
   * back in `reviews.list`.
   */
  publishedEarlier: boolean;
  onDraftChange: (draft: ReviewDraft) => void;
  onPublished: () => void;
  /** The sent review has arrived in the list; the workspace can forget it. */
  onPublishedConfirmed: () => void;
}

/**
 * One open course, being reviewed.
 *
 * The draft is the caller's: the pane keeps it per course so switching tabs
 * does not lose it. Publishing goes through `reviews.create` via the reviews
 * feature's own `useAddReview`, and a visitor is asked to sign in first — the
 * one thing on this surface that needs an account.
 */
export function ReviewDraftPanel({
  courseCode,
  draft: openDraft,
  publishedEarlier,
  onDraftChange,
  onPublished,
  onPublishedConfirmed,
}: Readonly<ReviewDraftPanelProps>) {
  const { user, userId, isAuthenticated, isLoading: sessionLoading } = useMe();
  const addReview = useAddReview();
  const details = useCourseDetails(courseCode);
  const courseReviews = useReviewList(courseCode);
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);
  const examTrackRef = useRef<HTMLDivElement>(null);

  /**
   * What was published, once something was.
   *
   * A published draft is no longer a draft — it is a Review, with a row — so
   * the workspace forgets it and stops keeping it in the tab's storage.
   * Reopening the tab a week later must not offer a second copy of a review
   * that is already live. The panel keeps its own snapshot so the writer can
   * still see what they sent, and stops taking edits to it.
   */
  const [publishedDraft, setPublishedDraft] = useState<ReviewDraft | null>(
    null,
  );
  const justPublished = publishedDraft !== null;
  const published = justPublished || publishedEarlier;
  const draft = publishedDraft ?? openDraft;

  /** Edits stop at the moment of publishing; after that there is a Review. */
  function update(next: ReviewDraft) {
    if (published) return;
    onDraftChange(next);
  }

  // Signing in navigated the page away and back. The draft came with it
  // through `sessionStorage`; this is the note that says so, and only the
  // course that asked for the sign-in may claim it.
  useEffect(() => {
    if (sessionLoading || !isAuthenticated) return;
    if (claimAwaitingSignIn(courseCode)) setJustSignedIn(true);
  }, [sessionLoading, isAuthenticated, courseCode]);

  const course = details.data;
  const done = sectionsDone(draft);
  /**
   * A course takes one review per person, so a draft for a course the viewer
   * has already reviewed has nowhere to go.
   *
   * The check is here rather than in the tab's own memory because the review
   * outlives the tab: it may have been published last week, or from the course
   * page's own dialog. Nothing on the server refuses the second write — there
   * is no unique key on `(user_id, course_code)` and `createReview` does not
   * look — so a second publish would quietly add a row and move the course's
   * averages. Flagged in the PR: that guard belongs in the reviews domain.
   */
  const reviewedInList =
    userId !== "" &&
    (courseReviews.data ?? []).some((review) => review.userId === userId);
  const alreadyReviewed = published || reviewedInList;
  const publishable = canPublish(draft) && !alreadyReviewed;

  /**
   * The workspace's note that it published covers one window: between the
   * write and `reviews.list` catching up. Once the review is in the list, the
   * list is the authority and the note is dropped — otherwise deleting the
   * review would leave a workspace that refuses to let its owner write another
   * one, which is a course they can no longer review at all.
   */
  useEffect(() => {
    if (publishedEarlier && reviewedInList) onPublishedConfirmed();
  }, [publishedEarlier, reviewedInList, onPublishedConfirmed]);
  const cuts = dividerPositions(draft);
  const examDisabled = draft.examinationForgotten;
  const approachDisabled = draft.approachForgotten;

  function patch(changes: Partial<ReviewDraft>) {
    update({ ...draft, ...changes });
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
      update(moveDivider(start, index, percent));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function publish() {
    const input = toReviewInput(draft);
    if (!input || alreadyReviewed) return;
    if (!isAuthenticated) {
      markAwaitingSignIn(courseCode);
      setAuthReason("post-review");
      return;
    }
    setPublishing(true);
    const ok = await addReview(courseCode, {
      ...input,
      message: input.message ?? "",
    });
    setPublishing(false);
    if (!ok) return;
    setPublishedDraft(draft);
    onPublished();
    onDraftChange(EMPTY_REVIEW_DRAFT);
  }

  const meta = course
    ? `${formatHp(course.credits)} hp · ${course.courseCode}${course.department ? ` · ${course.department}` : ""}`
    : courseCode;

  return (
    <div className="flex min-h-full flex-col">
      {/* Solid, for the same reason the details header is — see there. */}
      <div className="bg-cc-warn-solid px-5 pt-[18px] pb-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold text-[11px] text-cc-warn-ink uppercase tracking-[0.06em]">
            Review draft
          </div>
          <div className="text-[11.5px] text-cc-dim">
            {isUntouched(draft) ? "Not saved yet" : "Saved just now"}
          </div>
        </div>
        <h2 className="mt-1.5 font-semibold text-[19px] leading-[1.2]">
          {course?.titleEng ?? courseCode}
        </h2>
        <p className="mt-[3px] text-[13px] text-cc-muted">{meta}</p>
      </div>

      <div className="sticky top-0 z-[4] border-cc-warn-border border-b bg-cc-warn-solid px-5 pt-[11px] pb-3">
        <div className="text-[11.5px] text-cc-dim">
          {done} of {REVIEW_DRAFT_SECTIONS} sections done
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {Array.from({ length: REVIEW_DRAFT_SECTIONS }, (_, index) => (
            <div
              key={`section-${index + 1}`}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index < done ? "bg-cc-warn-btn" : "bg-cc-pill",
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 bg-cc-surface px-5 pt-4 pb-5">
        <Card>
          <Kicker>Format</Kicker>
          <div className="mt-[5px] flex items-baseline justify-between gap-2.5">
            <span className="font-semibold text-[14.5px]">
              How was it examined?
            </span>
            {!examDisabled && (
              <ValuePill>
                {draft.methods.length > 0
                  ? draft.shares.join(" / ")
                  : "Not set"}
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
                  onClick={() => update(toggleMethod(draft, key))}
                  className={cn(
                    "flex h-[30px] items-center gap-1.5 rounded-[15px] border px-[11px] text-[12.5px] disabled:opacity-40",
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
                    update(nudgeDivider(draft, index, -1));
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    update(nudgeDivider(draft, index, 1));
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
            <input
              type="range"
              min={MIN_SHARE}
              max={100 - MIN_SHARE}
              step={MIN_SHARE}
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
                    "flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[9px] border text-[13.5px] hover:border-cc-brand",
                    picked
                      ? "border-cc-brand bg-cc-pill font-semibold text-cc-brand"
                      : "border-cc-rule3 bg-cc-surface font-medium text-cc-chip-ink",
                  )}
                >
                  <span
                    aria-hidden="true"
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
                className="flex h-7 items-center rounded-[14px] border border-cc-hov border-dashed bg-cc-pill px-[11px] font-medium text-[11.5px] text-cc-brand"
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
            className="mt-2.5 block min-h-[104px] w-full resize-y rounded-[10px] border border-cc-rule3 bg-cc-surface p-3 text-[13.5px] text-cc-ink2 leading-[1.55] outline-none focus-visible:border-cc-hov"
          />
          <p className="mt-1.5 text-[11.5px] text-cc-muted">
            Be constructive and respectful
          </p>
        </Card>
      </div>

      <div className="sticky bottom-0 mt-auto border-cc-rule border-t bg-cc-surface">
        {justSignedIn && !published && (
          <p className="flex items-center gap-2.5 border-cc-rule border-b bg-cc-pill px-5 py-2.5 text-[12.5px] text-cc-brand leading-[1.45]">
            Signed in{user?.name ? ` as ${user.name}` : ""}. Your draft came
            back untouched — check it and publish when you are ready.
          </p>
        )}
        {justPublished && (
          <p
            className="flex items-center gap-2.5 border-cc-rule border-b px-5 py-2.5 text-[12.5px]"
            style={{
              background:
                "color-mix(in srgb, var(--cc-success) 12%, var(--cc-surface))",
              color: "var(--cc-success)",
            }}
          >
            Published. Thanks — your review is live on the course.
          </p>
        )}
        {alreadyReviewed && !justPublished && (
          <p className="border-cc-rule border-b bg-cc-pill px-5 py-2.5 text-[12.5px] text-cc-brand leading-[1.45]">
            You have already reviewed this course. Edit or delete it from the
            course's reviews — a course takes one review per person.
          </p>
        )}
        <div className="flex justify-end gap-2.5 px-5 py-3">
          <button
            type="button"
            disabled={
              !publishable ||
              publishing ||
              published ||
              sessionLoading ||
              courseReviews.isLoading
            }
            title={
              alreadyReviewed
                ? "You have already reviewed this course"
                : publishable
                  ? undefined
                  : "Answer happy, workload and learning to publish — the write-up is the only optional part"
            }
            onClick={publish}
            className={cn(
              "flex h-9 items-center rounded-[8px] px-4 font-semibold text-[13px]",
              publishable && !published
                ? "bg-cc-warn-btn text-cc-warn-btn-fg"
                : "cursor-not-allowed bg-cc-pill text-cc-dim",
            )}
          >
            {justPublished
              ? "Published"
              : justSignedIn
                ? "Publish review"
                : "Post review"}
          </button>
        </div>
      </div>

      <AuthReasonDialog
        reason={authReason}
        onReasonChange={setAuthReason}
        onClose={() => {
          setAuthReason(null);
          // Backing out of the dialog is not signing in, so the note that
          // would greet them on the way back goes with it.
          clearAwaitingSignIn(courseCode);
        }}
      />
    </div>
  );
}
