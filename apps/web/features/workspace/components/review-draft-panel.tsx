"use client";

import { useEffect, useRef, useState } from "react";
import { type AuthReason, AuthReasonDialog, useMe } from "@/features/auth";
import { useCourseDetails } from "@/features/courses";
import {
  isAnswered,
  ReviewDraftEditor,
  useAddReview,
  useEditReview,
  useReviewList,
} from "@/features/reviews";
import {
  EMPTY_REVIEW_DRAFT,
  isUntouched,
  REVIEW_DRAFT_SECTIONS,
  type ReviewDraft,
  sectionsDone,
  toReviewDraft,
  toReviewFormData,
} from "@/features/reviews/lib/review-draft";
import { formatHp } from "@/lib/kth";
import { cn } from "@/lib/utils";
import { withOpenCourse } from "../lib/open-courses";
import {
  claimAwaitingSignIn,
  clearAwaitingSignIn,
  markAwaitingSignIn,
} from "../lib/workspace-storage";

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
 * The form itself is `ReviewDraftEditor`, the reviews feature's own; this is
 * everything around it that belongs to the pane — the progress header, the
 * sign-in dance, the Post button, and the draft that outlives the tab.
 *
 * ## Writing, and rewriting
 *
 * The tab has two states, and which one it is in is the answer to one question:
 * does `reviews.list` already hold a review by this viewer for this course?
 *
 * - **No.** The panel writes. The draft is the caller's — the pane keeps it per
 *   course in `localStorage` so switching tabs or signing in does not lose it —
 *   and publishing goes through `useAddReview`.
 * - **Yes.** The panel rewrites that review. The draft is the *row*, read
 *   through `toReviewDraft`, and unsaved edits live in this component until the
 *   writer saves them with `useEditReview`. Nothing is mirrored to
 *   `localStorage`: a published review is not a draft, and a half-finished edit
 *   to one is not work the browser should be holding on the writer's behalf a
 *   week later.
 *
 * A course takes one review per person, so those are the only two states, and
 * the tab is no longer a dead end for a viewer who has already reviewed the
 * course — it used to draw the form and then refuse to send it.
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
  const editReview = useEditReview();
  const details = useCourseDetails(courseCode);
  const courseReviews = useReviewList(courseCode);
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);

  /**
   * What was published, once something was.
   *
   * A published draft is no longer a draft — it is a Review, with a row — so
   * the workspace forgets it and stops keeping it in the browser's storage.
   * Reopening the tab a week later must not offer a second copy of a review
   * that is already live. The panel keeps its own snapshot so the writer can
   * still see what they sent, and stops taking edits to it.
   *
   * It gives way to the editor as soon as the list catches up: from then on the
   * row is the thing on screen and rewriting it is a real offer, which is
   * better than a frozen copy of what was sent.
   */
  const [publishedDraft, setPublishedDraft] = useState<ReviewDraft | null>(
    null,
  );

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

  /**
   * The viewer's own review of this course, if `reviews.list` has one.
   *
   * It is what decides whether this tab writes or rewrites, and it is read from
   * the list rather than from anything the pane remembers because the review
   * outlives the tab: it may have been published last week, or from another
   * browser. The list is the authority; the pane's own note (`publishedAt`)
   * only covers the seconds before the list has caught up.
   */
  const mine =
    userId === ""
      ? undefined
      : (courseReviews.data ?? []).find((review) => review.userId === userId);

  /**
   * An edit in progress, and the review it belongs to.
   *
   * Held here rather than derived into state by an effect, so that there is no
   * moment where the two disagree: with `mine` as the fallback, a refetch that
   * replaces the row simply re-derives the form from it, and an edit that is
   * still on screen keeps its own answers because its id still matches.
   */
  const [edit, setEdit] = useState<{ id: string; draft: ReviewDraft } | null>(
    null,
  );

  const editing = mine !== undefined;
  const dirty = mine !== undefined && edit?.id === mine.id;
  const frozen = mine === undefined ? publishedDraft : null;
  const justPublished = frozen !== null;

  /**
   * What the form is showing, in priority order: the frozen copy of a review
   * just sent, then an edit in progress, then the row it edits, then the
   * unpublished draft this tab was opened with.
   */
  const draft =
    frozen ??
    (mine === undefined
      ? openDraft
      : dirty && edit !== null
        ? edit.draft
        : toReviewDraft(mine));

  /**
   * The pane's note that it published covers one window: between the write and
   * `reviews.list` catching up. Only a request started *after* the write can
   * close that window, so this panel starts one itself rather than reading the
   * clock on whatever response happens to arrive next.
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

  /**
   * The window after a publish in which the list has not caught up yet.
   *
   * Only reachable while `mine` is still missing — once the row arrives the tab
   * is an editor for it — and it is what stops the pane offering a Post button
   * whose only outcome is `createReview` refusing a second review for the same
   * `(user_id, course_code)` pair. That refusal is the guard; this is the
   * courtesy.
   */
  const awaitingPublished = !editing && (justPublished || publishedAt !== null);
  const publishable = isAnswered(draft) && !awaitingPublished;
  const savable = isAnswered(draft) && dirty;

  /** Edits stop at the moment of publishing; after that there is a Review. */
  function update(next: ReviewDraft) {
    if (justPublished) return;
    if (mine !== undefined) {
      setEdit({ id: mine.id, draft: next });
      return;
    }
    onDraftChange(next);
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
    if (!form || awaitingPublished) return;
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

  async function save() {
    const form = toReviewFormData(draft);
    if (!form || mine === undefined) return;
    setSaving(true);
    const ok = await editReview(mine.id, form);
    setSaving(false);
    // Dropping the local edit hands the form back to the row, which the
    // mutation has just invalidated. Keeping it would leave the writer looking
    // at their own copy of something the list is about to restate.
    if (ok) setEdit(null);
  }

  const meta = course
    ? `${formatHp(course.credits)} hp · ${course.courseCode}${course.department ? ` · ${course.department}` : ""}`
    : courseCode;
  const done = sectionsDone(draft);

  return (
    <div className="flex min-h-full flex-col">
      {/* Solid, for the same reason the details header is — see there. */}
      <div className="bg-cc-warn-solid px-5 pt-[18px] pb-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold text-[11px] text-cc-warn-ink uppercase tracking-[0.06em]">
            {editing ? "Your review" : "Review draft"}
          </div>
          <div className="text-[11.5px] text-cc-dim">
            {editing
              ? dirty
                ? "Unsaved changes"
                : "Published"
              : isUntouched(draft)
                ? "Not saved yet"
                : "Saved just now"}
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

      <div className="bg-cc-surface px-5 pt-4 pb-5">
        <ReviewDraftEditor draft={draft} onChange={update} />
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
          pass "restores". Do not add the button.

          A review being *rewritten* is the one case with a genuine unsaved
          state, and it gets a real pair of buttons below — nothing is mirrored
          anywhere until the writer says so. */}
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
        {justSignedIn && !justPublished && !editing && !isUntouched(draft) && (
          <p className="flex items-center gap-2.5 border-cc-rule border-b bg-cc-pill px-5 py-2.5 text-[12.5px] text-cc-brand leading-[1.45]">
            Signed in{user?.name ? ` as ${user.name}` : ""}. Your draft came
            back untouched — check it and publish when you are ready.
          </p>
        )}
        {justSignedIn && !justPublished && !editing && isUntouched(draft) && (
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
            flat mix that is not a percentage of anything. */}
        {justPublished && (
          <p className="flex items-center gap-2.5 border-cc-rule border-b bg-cc-success-tint px-5 py-2.5 text-[12.5px] text-cc-success-ink">
            Published. Thanks — your review is live on the course.
          </p>
        )}
        {awaitingPublished && !justPublished && (
          <p className="border-cc-rule border-b bg-cc-pill px-5 py-2.5 text-[12.5px] text-cc-brand leading-[1.45]">
            You have already reviewed this course. Loading it so you can change
            it — a course takes one review per person.
          </p>
        )}
        {editing ? (
          <div className="flex items-center justify-end gap-2.5 px-5 py-3">
            {dirty ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setEdit(null)}
                className="flex h-9 cursor-pointer items-center rounded-[8px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-chip-ink disabled:cursor-not-allowed"
              >
                Discard changes
              </button>
            ) : null}
            <button
              type="button"
              disabled={!savable || saving}
              title={
                dirty
                  ? savable
                    ? undefined
                    : "Answer happy, workload and learning to save — the write-up is the only optional part"
                  : "Change something to save"
              }
              onClick={save}
              className={cn(
                "flex h-9 cursor-pointer items-center rounded-[8px] px-4 font-semibold text-[13px] disabled:cursor-not-allowed",
                savable
                  ? "bg-cc-warn-btn text-cc-warn-btn-fg"
                  : "bg-cc-pill text-cc-dim",
              )}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-2.5 px-5 py-3">
            <button
              type="button"
              disabled={
                !publishable ||
                publishing ||
                sessionLoading ||
                courseReviews.isLoading
              }
              title={
                awaitingPublished
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
        )}
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
