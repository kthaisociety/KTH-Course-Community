"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAddReview } from "../hooks/use-add-review";
import {
  EMPTY_REVIEW_DRAFT,
  type ReviewDraft,
  toReviewFormData,
} from "../lib/review-draft";
import {
  type CardOutcome,
  type ReviewerSession,
  writeReviewerSession,
} from "../lib/reviewer-session";
import { ReviewerCard, type ReviewerCardCourse } from "./reviewer-card";

/** The artboard's `revSaveErrorText`, kept word for word. */
const SAVE_FAILED =
  "That review did not reach the server. Nothing was lost — your answers are still on the card.";

/** How many cards are drawn peeking out behind the active one. */
const PEEK_DEPTH = 2;
const PEEKS = [
  { translate: "14px", scale: 0.975, opacity: 1 },
  { translate: "26px", scale: 0.95, opacity: 0.65 },
];

type Round = {
  /** The course codes queued for this round, in the order they are dealt. */
  order: string[];
  /** What happened to each card. A code that is absent is still to come. */
  done: Record<string, CardOutcome>;
  /** Answers per course, kept while the round runs so a card can be revisited. */
  drafts: Record<string, ReviewDraft>;
};

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((code, index) => code === b[index]);
}

export interface ReviewerProps {
  /**
   * The courses to deal, in order — captured when the reviewer opened rather
   * than tracked live. A queue that shrank under the reviewer as each save
   * landed would renumber "Card 3 of 8" mid-round and drop the cards behind the
   * active one, which is the opposite of what the stack is for.
   */
  queue: ReviewerCardCourse[];
  /**
   * A round this tab left unfinished, to pick back up — progress and unsaved
   * answers included. `null` starts a fresh round.
   *
   * It arrives as a prop rather than being read from `sessionStorage` here on
   * purpose. Whether a stored round is still worth resuming depends on which
   * courses are *currently* unreviewed, which this component has no way to
   * know: it is handed a queue and deals it. `TakenCourses` owns that
   * judgement, and it hands over a session it has already pruned, so `queue`
   * and `restored.queue` are the same list.
   */
  restored?: ReviewerSession | null;
  /** Leaves the reviewer and ends the round; the queue is not kept. */
  onClose: () => void;
}

/**
 * The **fast-track reviewer** — the full-screen card stack drawn by the
 * `isReviewer` branch of `docs/design_ref_new/Course Community - Taken
 * Courses.dc.html`, reached from the unreviewed prompt, from My Page's own
 * prompt via `/taken?review=1`, and from a row in either.
 *
 * ## It is a second form, not a second write path
 *
 * The card asks the same four questions the workspace pane's review draft asks,
 * in a shape built for a queue rather than for a column. What it does *not*
 * have is a write of its own: `toReviewFormData` is the only mapping, and
 * `useAddReview` is the only submit — the same hook the pane and the review
 * dialog call, which validates every review with `reviewFormSchema` before it
 * sends anything. Two presentations, one write path, one validator.
 *
 * ## Skipping leaves the course exactly as it was
 *
 * The screen's own copy promises it: *"Skip the ones you have no opinion about
 * — they stay in the list as unreviewed."* A skip therefore writes nothing at
 * all. It is not a stored decision, not a dismissal, and not a row — the course
 * is unreviewed for the same reason it was before, because no review exists for
 * it, and the next round will offer it again.
 *
 * ## The round survives a reload
 *
 * Which courses were skipped and which were answered is the one thing here that
 * is not re-derivable from the server, and the answers on an unsaved card have
 * no row anywhere. Both are written to `sessionStorage` on every change — see
 * `reviewer-session.ts` for why the tab, and not the account, is the right
 * place for them. Reading one back is `TakenCourses`' call, not this
 * component's: see `restored`.
 */
export function Reviewer({
  queue,
  restored = null,
  onClose,
}: Readonly<ReviewerProps>) {
  const addReview = useAddReview();

  /**
   * The names arrive after the codes do — `course.summary` is one request per
   * course — so the queue prop is re-read for display on every render, while
   * the round itself is seeded once. A title landing late must update the card;
   * it must not restart the round.
   */
  const courses = new Map(queue.map((course) => [course.courseCode, course]));

  const [round, setRound] = useState<Round>(() => {
    const order = queue.map((course) => course.courseCode);
    // Belt and braces on the caller's promise. A restored round is only this
    // round if it is the same queue in the same order; anything else would put
    // one round's answers onto another round's cards, so it is discarded
    // rather than half-applied.
    return restored && sameOrder(restored.queue, order)
      ? { order, done: restored.done, drafts: restored.drafts }
      : { order, done: {}, drafts: {} };
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    writeReviewerSession({
      queue: round.order,
      done: round.done,
      drafts: round.drafts,
    });
  }, [round]);

  const activeIndex = round.order.findIndex((code) => !round.done[code]);
  const activeCode = activeIndex === -1 ? null : round.order[activeIndex];
  const remaining =
    activeIndex === -1 ? 0 : round.order.length - activeIndex - 1;
  // Both counted across `order`, never across `done`. `done` is a map, and a
  // map restored from a tab's storage can hold a code this round is not
  // dealing — which would have the done screen report a course the reader
  // never saw. The queue is what this round is; the map only says what
  // happened to the courses in it.
  const savedCount = round.order.filter(
    (code) => round.done[code] === "saved",
  ).length;
  const skippedCodes = round.order.filter(
    (code) => round.done[code] === "skipped",
  );

  function finish(code: string, outcome: CardOutcome) {
    setSaveError(null);
    setRound((current) => ({
      ...current,
      done: { ...current.done, [code]: outcome },
    }));
  }

  async function save() {
    if (activeCode === null || isSaving) return;
    const form = toReviewFormData(
      round.drafts[activeCode] ?? EMPTY_REVIEW_DRAFT,
    );
    // The button is disabled without the three required answers; this is the
    // guard for the paths that are not the button, such as "Try again".
    if (!form) return;

    setIsSaving(true);
    setSaveError(null);
    const published = await addReview(activeCode, form);
    setIsSaving(false);
    // `useAddReview` has already said what went wrong, in a toast. The row is
    // what keeps the card — and the answers on it — in front of the reviewer
    // instead of advancing past work that was never stored.
    if (!published) {
      setSaveError(SAVE_FAILED);
      return;
    }
    finish(activeCode, "saved");
  }

  return (
    <div className="@container flex min-w-0 flex-1 flex-col px-5">
      <div className="flex items-start justify-between gap-6 border-cc-rule border-b pt-[18px] pb-4 @max-[520px]:flex-col @max-[520px]:gap-3">
        <div className="min-w-0">
          <p className="m-0 font-semibold text-[11px] text-cc-warn-ink uppercase tracking-[0.09em]">
            Quick review
          </p>
          <h2 className="m-0 mt-[7px] font-semibold text-[19px] leading-[1.25]">
            One card per course
          </h2>
          <p className="m-0 mt-2 max-w-[560px] text-[13.5px] text-cc-muted leading-[1.5]">
            Four quick questions and a line of text per course. Skip the ones
            you have no opinion about — they stay in the list as unreviewed.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-[38px] flex-none cursor-pointer items-center gap-2 rounded-[9px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-chip-ink hover:border-cc-hov"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Back to courses
        </button>
      </div>

      <div className="flex items-center gap-3.5 pt-4">
        {/*
          The segments are decoration — a screen reader gets nothing from
          twelve unlabelled bars — so this line is the only progress a
          non-sighted reviewer has. `<output>` is a live region, which is
          what makes it arrive when a card is saved or skipped rather than
          only when someone goes looking for it; it is the element the rest
          of this app already uses for the same job.
        */}
        <output className="m-0 flex-none font-medium text-[12px] text-cc-dim tabular-nums">
          {activeCode === null
            ? `${round.order.length} ${round.order.length === 1 ? "card" : "cards"} done`
            : `Card ${activeIndex + 1} of ${round.order.length}`}
        </output>
        <div aria-hidden className="flex flex-1 gap-[5px]">
          {round.order.map((code) => (
            <span
              key={code}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                round.done[code]
                  ? "bg-cc-btn"
                  : code === activeCode
                    ? "bg-cc-brand/50"
                    : "bg-cc-pill",
              )}
            />
          ))}
        </div>
      </div>

      {activeCode !== null ? (
        <div className="flex flex-1 justify-center pt-[22px] pb-9">
          <div className="relative w-full max-w-[640px]">
            {PEEKS.slice(0, Math.min(PEEK_DEPTH, remaining)).map((peek) => (
              <div
                key={peek.translate}
                aria-hidden
                className="absolute inset-0 rounded-[16px] border border-cc-rule2 bg-cc-surface"
                style={{
                  transform: `translateY(${peek.translate}) scale(${peek.scale})`,
                  opacity: peek.opacity,
                }}
              />
            ))}
            <ReviewerCard
              key={activeCode}
              course={courses.get(activeCode) ?? { courseCode: activeCode }}
              draft={round.drafts[activeCode] ?? EMPTY_REVIEW_DRAFT}
              // The artboard's `revStackLabel` is
              // `(queue - at - 1) + " more after this"`, which on the final
              // card renders "0 more after this" — a sentence that has to be
              // read twice to mean "this is the last one". It says that
              // instead.
              stackLabel={
                remaining === 0 ? "Last one" : `${remaining} more after this`
              }
              isLast={remaining === 0}
              isSaving={isSaving}
              saveError={saveError}
              onDraftChange={(draft) =>
                setRound((current) => ({
                  ...current,
                  drafts: { ...current.drafts, [activeCode]: draft },
                }))
              }
              onSkip={() => finish(activeCode, "skipped")}
              onSave={() => void save()}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 justify-center pt-7 pb-10">
          <div className="w-full max-w-[520px] rounded-[16px] border border-cc-rule bg-cc-surface px-[26px] pt-[30px] pb-[26px] text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-cc-success-tint text-cc-success-ink">
              <Check size={22} strokeWidth={2.2} aria-hidden />
            </span>
            <h3 className="m-0 mt-3.5 font-semibold text-[21px] tracking-[-0.01em]">
              {savedCount === 0
                ? "Nothing reviewed this round"
                : savedCount === 1
                  ? "1 course reviewed"
                  : `${savedCount} courses reviewed`}
            </h3>
            {/*
              The artboard's no-skips line ends "You can reopen a card from the
              Reviewed column any time." It cannot: that column is a static
              "Done" / "Not yet" label in `taken-course-row.tsx`, with nothing
              to click. Rewriting a review is the review card's own edit, on the
              course, so the sentence is dropped rather than pointed somewhere
              it was not about.
            */}
            <p className="m-0 mt-2 text-[13.5px] text-cc-muted leading-[1.55]">
              {skippedCodes.length > 0
                ? `The ${skippedCodes.length} you skipped are still marked unreviewed in your list — pick any of them up from there.`
                : "Every course in this round is marked reviewed in your list."}
            </p>
            <div className="mt-5 flex justify-center gap-2.5 @max-[420px]:flex-col">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 cursor-pointer items-center justify-center rounded-[9px] bg-cc-btn px-[18px] font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[0.88]"
              >
                Back to my courses
              </button>
              {skippedCodes.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setRound((current) => ({
                      order: current.order.filter(
                        (code) => current.done[code] === "skipped",
                      ),
                      done: {},
                      drafts: current.drafts,
                    }))
                  }
                  className="flex h-10 cursor-pointer items-center justify-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-4 font-medium text-[13.5px] text-cc-chip-ink hover:border-cc-hov"
                >
                  Go through the skipped ones
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
