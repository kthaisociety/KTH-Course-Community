"use client";

import { useEffect, useRef, useState } from "react";
import { type AuthReason, AuthReasonDialog, useMe } from "@/features/auth";
import { useCourseDetails } from "@/features/courses";
import {
  APPLIED_FILL,
  APPROACH_MAX,
  APPROACH_MIDPOINT,
  APPROACH_MIN,
  dividerPositions,
  EXAMINATION_COLORS,
  EXAMINATION_INK,
  type ExaminationKey,
  isAnswered,
  MIN_SHARE,
  moveDivider,
  nudgeDivider,
  ScoreSlider,
  toggleMethod,
  UNSET_FILL,
  useAddReview,
  useReviewList,
  ValuePill,
} from "@/features/reviews";
import { formatHp } from "@/lib/kth";
import { cn } from "@/lib/utils";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  EXAMINATION_DISTRIBUTION_LABELS,
} from "@/types";
import { withOpenCourse } from "../lib/open-courses";
import {
  EMPTY_REVIEW_DRAFT,
  isUntouched,
  REVIEW_DRAFT_SECTIONS,
  type ReviewDraft,
  sectionsDone,
  toReviewFormData,
} from "../lib/review-draft";
import {
  claimAwaitingSignIn,
  clearAwaitingSignIn,
  markAwaitingSignIn,
} from "../lib/workspace-storage";
import { Kicker } from "./pane-parts";

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
            **Do not remove this ring as a duplicate of `globals.css`'s.** #167
            deleted nine hand-rolled focus treatments that the global
            `:focus-visible` rule had made redundant; this is the one that is
            not, and the reason is not visible from the class list.

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

export interface ReviewDraftPanelProps {
  courseCode: string;
  draft: ReviewDraft;
  /**
   * Whether this workspace has published a review for this course and is still
   * waiting for `reviews.list` to catch up. `null` once it has, and the list
   * has taken over as the authority.
   */
  publishedAt: number | null;
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
  publishedAt,
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
   * the workspace forgets it and stops keeping it in the browser's storage.
   * Reopening the tab a week later must not offer a second copy of a review
   * that is already live. The panel keeps its own snapshot so the writer can
   * still see what they sent, and stops taking edits to it.
   */
  const [publishedDraft, setPublishedDraft] = useState<ReviewDraft | null>(
    null,
  );
  const justPublished = publishedDraft !== null;
  const draft = publishedDraft ?? openDraft;

  /** Edits stop at the moment of publishing; after that there is a Review. */
  function update(next: ReviewDraft) {
    if (justPublished) return;
    onDraftChange(next);
  }

  // Signing in navigated the page away and back. The draft came with it
  // through `localStorage`; this is the note that says so, and only the course
  // that asked for the sign-in may claim it. The note itself is per-tab, so it
  // greets the tab that was thrown out — the magic link opens a new one, which
  // gets its draft back without being told it was ever at risk.
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
   * page's own dialog. It is a courtesy, not the guard — `createReview`
   * refuses the second write for a `(user_id, course_code)` pair and cannot be
   * raced into taking it. This is what stops the pane offering a button whose
   * only outcome is that refusal.
   */
  const reviewedInList =
    userId !== "" &&
    (courseReviews.data ?? []).some((review) => review.userId === userId);
  const alreadyReviewed =
    justPublished || reviewedInList || publishedAt !== null;
  const publishable = isAnswered(draft) && !alreadyReviewed;

  /**
   * The workspace's note that it published covers one window: between the
   * write and `reviews.list` catching up. Only a request started *after* the
   * write can close that window, so this panel starts one itself rather than
   * reading the clock on whatever response happens to arrive next.
   *
   * A response's arrival time cannot stand in for that. `dataUpdatedAt` records
   * when TanStack Query accepted a response, not when it asked for it, so a
   * list fetched before the write and settled after it looks newer than the
   * write while knowing nothing about it — and dropping the note on that
   * evidence would let the same review be published twice.
   *
   * The note has to be dropped eventually, and only on real evidence: one that
   * outlived its window would leave a reviewer who deleted their review unable
   * to write another, which is a course they could never review again.
   */
  const refetchReviews = courseReviews.refetch;
  const confirmRequested = useRef(false);
  const confirmPublished = useRef(onPublishedConfirmed);
  useEffect(() => {
    confirmPublished.current = onPublishedConfirmed;
  });
  useEffect(() => {
    if (publishedAt === null) {
      confirmRequested.current = false;
      return;
    }
    if (confirmRequested.current) return;
    confirmRequested.current = true;
    let live = true;
    void refetchReviews()
      .then((result) => {
        // A failed refetch says nothing, so the note stands and the next
        // mount of this tab asks again.
        if (!live) return;
        if (result.isSuccess) confirmPublished.current();
        else confirmRequested.current = false;
      })
      .catch(() => {
        confirmRequested.current = false;
      });
    return () => {
      live = false;
    };
  }, [publishedAt, refetchReviews]);
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
    /*
     * The write-up leaves the textarea as plain text and `reviews.message`
     * holds markup — it has exactly one renderer, `parse(sanitizeHtml(...))`
     * with `stripIgnoreTag` — so anything tag-shaped in a raw plain string is
     * deleted on the way to the screen and "use `<vector>` from STL" arrives as
     * "use from STL". `toReviewFormData` escapes it first, which is why
     * publishing goes through the reviews feature's mapper rather than handing
     * `draft.message` straight to `addReview`.
     */
    const form = toReviewFormData(draft);
    if (!form || alreadyReviewed) return;
    if (!isAuthenticated) {
      markAwaitingSignIn(courseCode);
      setAuthReason("post-review");
      return;
    }
    setPublishing(true);
    const ok = await addReview(courseCode, form);
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
            {/* The track's ends are the approach question's own, not the
                examination bar's minimum share — the two happen to be the same
                number today and mean different things. `toReviewFormData`
                clamps to exactly these, so a control bounded by anything else
                would let the writer set a value the mapper then quietly moved. */}
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
                className="cursor-pointer flex h-7 items-center rounded-[14px] border border-cc-hov border-dashed bg-cc-pill px-[11px] font-medium text-[11.5px] text-cc-brand"
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

      {/* The artboard's footer has two controls: a bordered "Save draft" beside
          the post button (`Course Community - Workspace Pane.dc.html`).
          Only the post button is here, deliberately.

          There is no unsaved state for a "Save draft" to resolve. Every
          keystroke goes `onDraftChange` → `patchDraft` → the `writeDrafts`
          effect in `workspace-pane.tsx`, so the button would either be a no-op
          or imply the draft had been at risk. The artboard's own reassurance is
          kept: its `savedLabel` is the "Not saved
          yet" / "Saved just now" line in this panel's header, word for word.

          Recorded because a deviation nobody wrote down is a deviation the next
          pass "restores". Do not add the button. */}
      <div className="sticky bottom-0 mt-auto border-cc-rule border-t bg-cc-surface">
        {/* Two greetings, because there are two things that can have happened
            and the banner used to claim the good one either way.

            "Your draft came back untouched" was rendered on `justSignedIn`
            alone, with nothing in the condition that had so much as looked at
            the draft — so the guest whose draft had just been overwritten with
            `{}` was told, on the empty form, that it had come back untouched.
            The overwrite is fixed in `workspace-pane.tsx`, and this is fixed
            separately, because a banner that asserts something it never checked
            is wrong even on the day nothing else is.

            The empty case is a sentence rather than silence. `publish()` only
            reaches the sign-in prompt with an answered draft — it returns before
            it unless `toReviewFormData` gave it a form — so a draft that is
            untouched on the way back is not a writer who typed
            nothing — it is work that existed and is gone, and the only useful
            thing to say is which. Silence would leave them staring at a blank
            form deciding whether they had imagined filling it in; the tint is
            the danger family, because this is the one banner here that reports
            a loss. */}
        {justSignedIn && !justPublished && !isUntouched(draft) && (
          <p className="flex items-center gap-2.5 border-cc-rule border-b bg-cc-pill px-5 py-2.5 text-[12.5px] text-cc-brand leading-[1.45]">
            Signed in{user?.name ? ` as ${user.name}` : ""}. Your draft came
            back untouched — check it and publish when you are ready.
          </p>
        )}
        {justSignedIn && !justPublished && isUntouched(draft) && (
          <p className="flex items-center gap-2.5 border-cc-rule border-b bg-cc-danger-tint px-5 py-2.5 text-[12.5px] text-cc-danger-ink leading-[1.45]">
            Signed in{user?.name ? ` as ${user.name}` : ""}, but your draft did
            not come back — this browser did not keep it. Sorry; you will have
            to write it again.
          </p>
        )}
        {/* The success tint family, which is what the artboard draws:
            `Course Community - Workspace Pane.dc.html` paints this
            banner `var(--successTint)` with `var(--successInk)` on the text and
            the tick. This used to derive the fill from `--cc-success` at 12%
            and take the *solid* for the text; neither is reachable that way,
            because dark states the tint as alpha over the page and light as a
            flat mix that is not a percentage of anything (#127 §1). */}
        {justPublished && (
          <p className="flex items-center gap-2.5 border-cc-rule border-b bg-cc-success-tint px-5 py-2.5 text-[12.5px] text-cc-success-ink">
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
              alreadyReviewed ||
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
              // `disabled:cursor-not-allowed` and not a bare `cursor-not-allowed`
              // on the unpublishable branch alone: publishing, an existing
              // review and a still-loading session all disable this button
              // while the draft itself is publishable, and those states want the
              // same cursor the incomplete draft gets.
              "flex h-9 cursor-pointer items-center rounded-[8px] px-4 font-semibold text-[13px] disabled:cursor-not-allowed",
              publishable
                ? "bg-cc-warn-btn text-cc-warn-btn-fg"
                : "bg-cc-pill text-cc-dim",
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
        // Sign in and come back to *this tab*, not just to this page. `?open=`
        // has been spent and removed by now, so the URL alone would bring them
        // back to the search behind the pane with the draft nowhere on screen.
        // It matters most on the email path, which opens a new tab where the
        // URL is the only thing that arrives.
        returnTo={(here) => withOpenCourse(here, courseCode, "review")}
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
