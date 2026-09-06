"use client";

import { CircleCheck, FileWarning, Info, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AuthReason, AuthReasonDialog, useMe } from "@/features/auth";
import { useCourseSummaries, useTakenCourses } from "@/features/courses";
import {
  clearReviewerSession,
  Reviewer,
  type ReviewerCardCourse,
  type ReviewerSession,
  readReviewerSession,
  UnreviewedCard,
  useUnreviewedTakenCourses,
} from "@/features/reviews";
import { PageColumn, PageHeader } from "@/features/shell";
import { formatHp } from "@/lib/kth";
import type { TranscriptProposal } from "@/server/ingest/transcript/service";
import { useTakenMutations } from "../api/mutations";
import { uploadTranscript } from "../api/transcript";
import {
  clearGuestProposal,
  parseHandoff,
  readGuestProposal,
  withHandoff,
  writeGuestProposal,
} from "../lib/guest-proposal";
import {
  parseReviewDeepLink,
  type ReviewDeepLink,
  reviewQueue,
} from "../lib/review-deep-link";
import {
  lastTranscriptImport,
  planTranscriptImport,
  type TakenEdits,
  type TakenRow,
  takenUpdateInput,
  toTakenRows,
} from "../lib/taken-rows";
import { AddTakenCourseDialog } from "./add-taken-course-dialog";
import { RemoveTakenCourseDialog } from "./remove-taken-course-dialog";
import { TAKEN_GRID, TakenCourseRow } from "./taken-course-row";
import { TranscriptDropZone } from "./transcript-drop-zone";
import { TranscriptProposalReview } from "./transcript-proposal";

const READ_FAILED_TITLE = "We could not read that transcript";

const COLUMNS = [
  "Code",
  "Course",
  "Credits",
  "Grade",
  "Year",
  "Reviewed",
  "Actions",
] as const;

/** "24 Aug 2026", as the artboard prints it. */
function readDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The line under a course's name on its reviewer card — the artboard's
 * `revMeta`. Both halves are self-reported and either may be missing, so this
 * prints what the row actually has rather than a shape with holes in it.
 */
function reviewerMeta(row: TakenRow): string | null {
  const parts = [
    row.earnedCredits === null ? null : `${formatHp(row.earnedCredits)} hp`,
    row.attendanceYear === null ? null : String(row.attendanceYear),
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The entries of `byCode` whose key is one of `codes`, in no particular order.
 *
 * A stored round's `done` and `drafts` are maps, and a map can hold a course
 * the pruned queue no longer contains — one reviewed elsewhere since, or
 * whatever an older build left behind. Carrying those through would have the
 * reviewer count a course the reader never saw.
 */
function pickByCode<T>(
  byCode: Record<string, T>,
  codes: readonly string[],
): Record<string, T> {
  const kept: Record<string, T> = {};
  for (const code of codes) {
    if (code in byCode) kept[code] = byCode[code];
  }
  return kept;
}

function importedSummary(added: number, filled: number): string {
  const parts: string[] = [];
  if (added > 0) {
    parts.push(added === 1 ? "1 new course" : `${added} new courses`);
  }
  if (filled > 0) {
    parts.push(
      filled === 1
        ? "1 course had a missing field filled in"
        : `${filled} courses had missing fields filled in`,
    );
  }
  return parts.length > 0
    ? `Transcript saved — ${parts.join(", ")}`
    : "Transcript read — nothing new in it";
}

/**
 * The reader's taken courses — `docs/design_ref/2026-09-06/Course Community - Taken
 * Courses.dc.html`.
 *
 * Four things about this screen are worth knowing before changing it.
 *
 * **A taken course has no title and no verdict.** `user_taken_courses` stores a
 * course code plus self-reported grade, credits, attendance and provenance.
 * Names are looked up here through `course.summary`; nothing on a row is a
 * review, and the Reviewed column reads the viewer's reviews rather than
 * anything on the row. Saving, taking and reviewing are three independent
 * relationships and this page never lets one stand in for another.
 *
 * **Nothing a transcript says is written until the reader confirms it.**
 * `POST /api/user/transcript` parses and returns a proposal; the writes happen
 * only on "Looks right", and `planTranscriptImport` decides what they are — a
 * re-read adds courses that are new and fills fields that are empty, and never
 * overwrites a correction the reader made by hand. The file itself is handed to
 * `uploadTranscript` and never kept — not in state, not in a cache, never in
 * `localStorage`.
 *
 * **Course codes the catalogue does not have are reported, not invented.**
 * They come back on the proposal as `unmatched` and are named on the confirm
 * screen. This page offers no way to create the missing course, because
 * `user_taken_courses.course_code` is a foreign key to `courses.code`.
 *
 * **The fast-track reviewer is a screen of this page, not a dialog over it.**
 * `Reviewer` is the artboard's `isReviewer` branch and it replaces the list
 * while a round runs — progress segments, peeked cards, "Skip for now", the
 * save-error row and the done screen. It is presentation only: it maps a card
 * onto `ReviewFormData` and hands it to `useAddReview`, which is the same hook
 * the workspace pane and the review dialog write through and the one place
 * `reviewFormSchema` runs. `?review=…` opens it on arrival — that is My Page's
 * deep link, and it carries the course a row named — and the parameter is taken
 * back out so a reload does not replay it.
 *
 * **A signed-out visitor gets the whole flow except the write.** The artboard
 * poses a guest on the empty screen rather than on a locked page
 * (`… - Taken Courses.dc.html`), lets them read a transcript, and asks for
 * the account at the *keep* step: the confirm button reads "Sign in to keep
 * this list" and the confirm is resumed once they are in (`:1305-1308`). That
 * is implementable only because parsing and writing are two calls —
 * `POST /api/user/transcript` parses and stores nothing, and
 * `transcript.confirm` is a `protectedProcedure` that nothing here weakens. The
 * proposal is handed across the sign-in by `../lib/guest-proposal`, which is
 * where the reasoning about what may be written down lives.
 *
 * **Removing a row confirms first.** The artboard confirms after, with an
 * undoable note; #155 settled that destructive actions confirm before, and a
 * taken course is the most destructive of the three because everything on the
 * row is self-reported and exists nowhere else. The note and its Undo stay: the
 * dialog is about the wrong row, the note is about the right one.
 */
export function TakenCourses() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isSessionLoading } = useMe();
  // `taken.list` is protected, so it waits for a session rather than sending a
  // request that would be refused — the same guard `useUnreviewedTakenCourses`
  // puts on the very same query.
  const takenQuery = useTakenCourses(isAuthenticated);
  const { data: taken, isPending, isError } = takenQuery;
  const { add, update, remove, confirmImport } = useTakenMutations();

  const takenCourses = taken ?? [];
  const courseCodes = takenCourses.map((course) => course.courseCode);
  const summaries = useCourseSummaries(courseCodes, isAuthenticated);
  const names = new Map(
    summaries.flatMap((query) =>
      query.data ? [[query.data.courseCode, query.data.titleEng] as const] : [],
    ),
  );
  const rows = toTakenRows(takenCourses, names);

  const {
    courses: unreviewed,
    isLoading: isReviewsLoading,
    isUnavailable: areReviewsUnavailable,
  } = useUnreviewedTakenCourses();
  // A course is "not reviewed" only once every review list has arrived. While
  // they are in flight, or when one failed, the column says nothing rather than
  // marking everything done.
  const reviewsKnown = !isReviewsLoading && !areReviewsUnavailable;
  const unreviewedCodes = new Set(
    unreviewed.map((course) => course.courseCode),
  );
  /**
   * A stable dependency for the effects below: `unreviewed` is a fresh array
   * on every render, so an effect that depended on it would run on every one.
   * The codes are what the queue is actually made of, and they round-trip
   * through a comma because `user_taken_courses.course_code` is a foreign key
   * to `courses.code`, which is a KTH course code — letters and digits, never
   * punctuation.
   */
  const unreviewedKey = unreviewed.map((course) => course.courseCode).join(",");

  const [addOpen, setAddOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [includeGrades, setIncludeGrades] = useState(false);
  const [proposal, setProposal] = useState<TranscriptProposal | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  /**
   * The row whose removal is waiting to be confirmed, or `null`. It is the
   * whole row rather than a code because the dialog names the course and says
   * which of the two removals this is — a hand-entered row can be put straight
   * back, an imported one cannot.
   */
  const [pendingRemove, setPendingRemove] = useState<TakenRow | null>(null);
  /** Why this page is asking for an account, or `null`. */
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);
  /** Whether the proposal on screen came back across a sign-in. */
  const [isResumed, setIsResumed] = useState(false);
  /**
   * The round on screen, or `null` when the list is. `restored` is the stored
   * progress and unsaved answers when the round is one this tab was already in
   * the middle of.
   */
  const [round, setRound] = useState<{
    queue: string[];
    restored: ReviewerSession | null;
  } | null>(null);
  /**
   * What the URL and the tab store asked for on arrival, held until the review
   * lists come back. Neither can be acted on before then: one needs the
   * unreviewed set to fill a queue, and the other needs it to know whether its
   * queue is still true.
   */
  const [pendingOpen, setPendingOpen] = useState<{
    /** What `?review=…` asked for, or `null` when the URL asked for nothing. */
    deepLink: ReviewDeepLink | null;
    session: ReviewerSession | null;
  } | null>(null);
  /** Whether the arrival below has already been read. See why it must be. */
  const hasReadArrival = useRef(false);
  /** Whether a proposal left for a sign-in has already been picked up. */
  const hasTakenHandoff = useRef(false);
  /**
   * The handoff token this arrival carried, read once on mount.
   *
   * Held in a ref rather than re-read where it is used, because the arrival
   * effect takes `?review=` back out with `router.replace("/taken")` and the
   * pickup below waits for the session — so by the time it runs, the URL may
   * already have been emptied of both parameters. Whether this page was
   * arrived at by a sign-in coming back is a fact about the moment it mounted.
   */
  const arrivedWithHandoff = useRef<string | null>(null);
  /**
   * The token for the proposal this page has just written down, or `null`.
   *
   * A ref because it is read when the reader picks a provider, not when
   * anything renders, and because it must not be stale by then: it is set in
   * the same handler that opens the dialog.
   */
  const pendingHandoff = useRef<string | null>(null);

  const lastImport = lastTranscriptImport(takenCourses);
  const isBusy = update.isPending || remove.isPending || add.isPending;

  /**
   * How the reviewer gets opened without a click: My Page's prompt deep-links
   * `/taken?review=…`, and a round this tab was in the middle of survives a
   * reload.
   *
   * **The parameter carries a course.** `?review=<CODE>` starts the round on
   * that course with the rest dealt behind it, which is what a row on My Page's
   * prompt means and what it could not say while the parameter was the bare
   * flag `1` (#157). `1` still means what it always did — open the reviewer, on
   * no particular course — so links already in the wild keep working;
   * `parseReviewDeepLink` is the whole contract.
   *
   * The query parameter is read from `window.location` rather than through
   * `useSearchParams`, which would need a `Suspense` boundary around this
   * screen in `app/` to keep the route prerenderable. It is a one-shot note
   * from another page, consumed on arrival and never rendered from, so an
   * effect is the honest place for it — and taking it back out with
   * `router.replace` is what stops a reload reopening the reviewer, the same
   * move the landing page makes with its own private-link parameter.
   *
   * **Once, and guarded by a ref rather than by its dependencies.** Arrival is
   * a moment, not a value: reading the URL a second time after `router.replace`
   * has emptied it would only ever say "no". The guard also keeps the effect
   * honest about the one dependency it has — `useRouter()` is stable in Next,
   * but nothing here needs it to be, and an effect that sets a fresh object on
   * every run would spin if it ever were not.
   */
  useEffect(() => {
    if (hasReadArrival.current) return;
    hasReadArrival.current = true;

    const search = window.location.search;
    const deepLink = parseReviewDeepLink(search);
    // Read before anything replaces the URL, and taken back out with it: a
    // spent capability has no business sitting in the address bar, in history,
    // or in whatever the reader pastes into a chat to show someone the page.
    arrivedWithHandoff.current = parseHandoff(search);
    if (deepLink !== null || arrivedWithHandoff.current !== null) {
      router.replace("/taken");
    }

    const session = readReviewerSession();
    if (deepLink !== null || session) setPendingOpen({ deepLink, session });
  }, [router]);

  /**
   * Picks up the transcript a signed-out reader left behind on their way to
   * sign in — the artboard's `pending: "confirm"` (`… - Taken Courses.dc.html`).
   *
   * **Only for the sign-in that left it.** The record is claimable only by an
   * arrival carrying its handoff token, which the confirm below put in the
   * return-to on the way out. Without one this does nothing at all, so a reader
   * who merely opens `/taken` on a shared browser — signed in as somebody else,
   * or still signed out — is never shown the previous visitor's transcript.
   * `guest-proposal.ts` sets out why the untokened signed-out read had to go
   * too: it was the step that let a second reader launder a first reader's rows
   * into their own account.
   *
   * **Spent on the first read, either way.** The token is single-use: whoever
   * presents a matching one gets the rows and the record is destroyed, session
   * or no session. Waiting for the session to be known still matters, because
   * it decides what the reader is *shown* — an account gets the resumed
   * preview, a reader whose sign-in did not take gets their own parse back and
   * can ask for the account again, which writes a fresh record under a fresh
   * token. Guarded by a ref as well, so Strict Mode's mount replay cannot spend
   * it twice.
   *
   * **What it does not do is confirm on its own.** The artboard finishes the
   * write the moment the account appears; this page puts the reader back on the
   * preview with "Looks right" under it instead. `use-guest-saves.ts` settled
   * the same question the same way for the saved list — *signing in is not
   * consent to write a list of courses to an account* — and it matters more
   * here, because the rows would be a student's grades and because
   * `localStorage` is a place other code on this origin can write. One click
   * over a list they can see is the whole difference.
   */
  useEffect(() => {
    if (hasTakenHandoff.current || isSessionLoading) return;
    hasTakenHandoff.current = true;

    const held = readGuestProposal(arrivedWithHandoff.current);
    if (held === null) return;
    // Claimed, and claimed *once*: a token that has been spent is spent whether
    // or not the sign-in behind it produced a session. Keeping the record alive
    // for a failed sign-in would leave a second, still-valid claim sitting in
    // this browser — the exact thing the token exists to prevent — and it buys
    // nothing, because the rows are in React state below and pressing "Sign in
    // to keep this list" again writes a fresh record under a fresh token.
    clearGuestProposal();
    pendingHandoff.current = null;
    setProposal(held.proposal);
    setIncludeGrades(held.includeGrades);
    setIsResumed(isAuthenticated);
  }, [isSessionLoading, isAuthenticated]);

  /**
   * Opens what the arrival asked for, once it is possible to be honest about
   * it. Both cases need the unreviewed set — one `reviews.list` per taken
   * course — so both wait for it, and both give up quietly if it never comes:
   * a screen that cannot say which courses need reviewing has no business
   * dealing cards for them.
   *
   * **A stored round is pruned, not trusted.** `sessionStorage` says what this
   * tab was doing, not what is still true; the reader may have reviewed some of
   * those courses in the workspace pane, or in another tab, since. So a course
   * survives the prune on exactly one of two grounds:
   *
   * - it is **still unreviewed**, so its card is worth dealing; or
   * - **this round saved it**, which is why it is no longer unreviewed. That is
   *   the round's own history and it is what the progress row counts.
   *
   * Everything else goes, and the case that matters is a course this round
   * *skipped* that has since been reviewed elsewhere. Its skip is a fact about
   * a moment that has passed: keeping it would have the done screen report a
   * course as "still unreviewed in your list" when it is not, and offer it
   * again under "Go through the skipped ones", which would deal a card for a
   * course that already has a review.
   *
   * If the prune leaves nothing still to deal, the round is over and gets
   * forgotten rather than reopened on its own done screen.
   *
   * **An interrupted round outranks the deep link**, because it holds answers
   * that were typed and never saved and a fresh queue would throw them away.
   */
  useEffect(() => {
    if (pendingOpen === null || !reviewsKnown) return;
    setPendingOpen(null);

    const stillUnreviewed =
      unreviewedKey === "" ? [] : unreviewedKey.split(",");
    const session = pendingOpen.session;
    if (session !== null) {
      const current = new Set(stillUnreviewed);
      const queue = session.queue.filter(
        (code) => current.has(code) || session.done[code] === "saved",
      );
      const hasCardsLeft = queue.some(
        (code) => session.done[code] === undefined,
      );
      if (hasCardsLeft) {
        // `done` and `drafts` are pruned to the same queue, so nothing the
        // round is not dealing can be counted on its done screen or restored
        // onto a card. The reviewer counts across the queue for the same
        // reason; this stops the strays being written back to storage too.
        setRound({
          queue,
          restored: {
            queue,
            done: pickByCode(session.done, queue),
            drafts: pickByCode(session.drafts, queue),
          },
        });
        return;
      }
      clearReviewerSession();
    }

    const deepLink = pendingOpen.deepLink;
    if (deepLink !== null && stillUnreviewed.length > 0) {
      // A course the link named that is no longer unreviewed is dropped by
      // `reviewQueue`, and the round opens on the rest — the same quiet
      // degrading the link already did when nothing at all was unreviewed.
      setRound({
        queue: reviewQueue(stillUnreviewed, deepLink.startCode),
        restored: null,
      });
    }
  }, [pendingOpen, reviewsKnown, unreviewedKey]);

  /**
   * Starts a round. `startCode` is the row the reader clicked, which goes to
   * the front rather than becoming a queue of one: the artboard deals the rest
   * of the unreviewed courses behind it, and someone who came to review one
   * course is exactly who is most likely to review a second.
   */
  function openReviewer(startCode?: string) {
    const queue = reviewQueue(
      unreviewed.map((course) => course.courseCode),
      startCode ?? null,
    );
    if (queue.length === 0) return;
    // A new round replaces whatever the tab was holding, drafts included.
    clearReviewerSession();
    setRound({ queue, restored: null });
  }

  function closeReviewer() {
    clearReviewerSession();
    setRound(null);
  }

  const reviewerCourses: ReviewerCardCourse[] = (round?.queue ?? []).map(
    (courseCode) => {
      const row = rows.find((taken) => taken.courseCode === courseCode);
      return {
        courseCode,
        name: names.get(courseCode) ?? null,
        meta: row ? reviewerMeta(row) : null,
      };
    },
  );

  /**
   * Reads one transcript. The file is a parameter and never becomes state, so
   * it is unreferenced the moment the request has been built — which is the
   * whole point: it is a student's academic record and this page may not keep
   * it. What is kept, until the reader confirms or discards it, is the
   * proposal, which holds no file and writes nothing.
   */
  async function readTranscript(file: File) {
    setUpdateOpen(false);
    setReadError(null);
    setConfirmError(null);
    setBanner(null);
    setIsReading(true);
    try {
      setProposal(await uploadTranscript(file));
    } catch (error) {
      setReadError(
        error instanceof Error && error.message
          ? error.message
          : "The file could not be read.",
      );
    } finally {
      setIsReading(false);
    }
  }

  /**
   * Opens the by-hand form, or asks for the account it would write to.
   *
   * The artboard offers "Add courses manually instead" on the same empty screen
   * it poses a guest on (`… - Taken Courses.dc.html`), and its own
   * handler just opens the form — its mock has no server to refuse the save.
   * Ours does: `taken.add` is a `protectedProcedure`. So a guest gets the
   * sign-in prompt here instead of a form whose Save cannot work.
   *
   * The reason is `sign-up` rather than the transcript gate's own: nothing is
   * waiting to be kept at this point, and "You keep everything you were looking
   * at" is the true thing to say to somebody who has typed nothing yet.
   */
  function startManualAdd() {
    if (!isAuthenticated) {
      setAuthReason("sign-up");
      return;
    }
    setAddOpen(true);
  }

  /**
   * Makes the writes the confirmed proposal describes, and only those.
   *
   * New courses go through `transcript.confirm`, which stamps them imported.
   * Courses the reader already has are only touched to fill an empty field,
   * and then through `taken.update`, which cannot overwrite what they
   * corrected by hand — see `planTranscriptImport`.
   *
   * **The plan is built against a freshly read list, not the render's copy.**
   * It lets the page fill fields that are already empty, and it makes retries
   * plan from what actually reached the database. `transcript.confirm` also
   * inserts only absent rows atomically, so a course another tab creates after
   * this refresh remains that tab's manual entry rather than being overwritten.
   *
   * **A re-read that fails writes nothing.** The render's copy is the very
   * snapshot the re-read exists to distrust, so falling back to it would put
   * back the overwrite this function was written to prevent — quietly, at the
   * one moment there is most reason to doubt it. A refused refresh stops the
   * import and says so, and a rejected one is caught here rather than escaping
   * as an unhandled rejection that leaves the proposal open explaining nothing.
   */
  async function confirmProposal() {
    if (!proposal || isConfirming) return;
    // The gate, and the point of the whole signed-out flow: the account is
    // asked for here rather than at the door, and the proposal is written down
    // first so the sign-in can bring it back. Nothing has been stored on the
    // server at this point and nothing is about to be.
    if (!isAuthenticated) {
      // The token comes back on the return-to and is the only thing that can
      // reopen this record — see `guest-proposal.ts`. `null` means storage
      // refused the write, and then the return-to stays plain `/taken`: there
      // is nothing to resume and no point advertising a token for it.
      pendingHandoff.current = writeGuestProposal(proposal, includeGrades);
      setAuthReason("keep-course-list");
      return;
    }
    setConfirmError(null);
    setIsConfirming(true);
    try {
      const current = await takenQuery.refetch();
      // A failed refetch keeps whatever the last good read returned, so the
      // error flag — not the presence of data — is what says this list can be
      // planned against.
      if (current.isError || !current.data) {
        setConfirmError(
          "We could not re-read your course list, so nothing was imported.",
        );
        return;
      }
      const plan = planTranscriptImport(
        proposal.candidates,
        current.data,
        includeGrades,
      );
      const written =
        plan.create.length === 0 && plan.fill.length === 0
          ? { inserted: 0, updated: 0 }
          : await confirmImport.mutateAsync(
              plan.fill.length > 0
                ? { courses: plan.create, fills: plan.fill }
                : { courses: plan.create },
            );
      setProposal(null);
      setIsResumed(false);
      clearGuestProposal();
      pendingHandoff.current = null;
      setBanner(
        importedSummary(written.inserted + written.updated, plan.fill.length),
      );
    } catch (error) {
      setConfirmError(
        error instanceof Error && error.message
          ? error.message
          : "That import did not reach the server.",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  async function addCourse(courseCode: string, edits: TakenEdits) {
    try {
      await add.mutateAsync({ courseCode, ...edits });
    } catch (error) {
      toast.error(`Could not add ${courseCode} to your courses.`);
      // Rethrown so the dialog keeps the draft the reader typed rather than
      // closing over a write that never landed.
      throw error;
    }
  }

  /**
   * Puts a removed row back exactly as it was, periods included — the row is
   * the whole record, not the three fields the table happens to show.
   */
  function restoreCourse(row: TakenRow) {
    add
      .mutateAsync({
        courseCode: row.courseCode,
        grade: row.grade,
        earnedCredits: row.earnedCredits,
        attendancePeriods: row.attendancePeriods,
        attendanceYear: row.attendanceYear,
      })
      .catch(() =>
        toast.error(`Could not put ${row.courseCode} back in your courses.`),
      );
  }

  async function saveEdits(row: TakenRow, edits: TakenEdits) {
    try {
      await update.mutateAsync(takenUpdateInput(row, edits));
    } catch (error) {
      toast.error(`Could not save your changes to ${row.name}.`);
      // Rethrown so the row stays in its editor holding what the reader typed.
      throw error;
    }
  }

  /**
   * Removes a row the reader has confirmed removing.
   *
   * The confirmation is not decoration. `CONTEXT.md` holds taken courses to be
   * **self-reported**: the grade, credits, year and periods on this row exist
   * nowhere but here, and the only cheap way back is reading a transcript
   * again — which cannot restore a hand-entered course at all. The artboard
   * confirms *after*, with a note; the product owner settled on confirming
   * before for every destructive action, and this is one of them (#155).
   *
   * The note stays anyway. Confirming before is about not removing the wrong
   * row; Undo is about the row it was right to remove and wrong to lose.
   */
  function removeCourse(row: TakenRow) {
    remove
      .mutateAsync({ courseCode: row.courseCode })
      .then(() => {
        // Undo is offered only for a row nobody imported. Putting an imported
        // row back would go through `taken.add`, which writes no
        // `transcript_imported_at` — the course would come back quietly
        // re-labelled as hand-entered, and nothing in the API can set that
        // column back to what it was.
        toast.success(`Removed ${row.courseCode}`, {
          action: row.transcriptImportedAt
            ? undefined
            : { label: "Undo", onClick: () => restoreCourse(row) },
        });
      })
      .catch(() =>
        toast.error(`Could not remove ${row.courseCode} from your courses.`),
      );
  }

  function screen() {
    if (isSessionLoading || (isAuthenticated && isPending)) {
      return <ListSkeleton />;
    }

    // The reviewer is a screen of this page, not something layered over it —
    // the artboard's `screen: "reviewer"`. It keeps the page header above it
    // and replaces everything else, so nothing underneath can be clicked while
    // a card is open.
    if (round !== null) {
      return (
        <Reviewer
          key={round.queue.join(",")}
          queue={reviewerCourses}
          restored={round.restored}
          onClose={closeReviewer}
        />
      );
    }

    if (proposal) {
      // `isConfirming` is the whole confirm, not just the create call: the
      // re-read before it and the fills after it are as much of the import as
      // the create is, and a button that went live between them would invite a
      // second one over a list the first is still changing.
      return (
        <TranscriptProposalReview
          proposal={proposal}
          includeGrades={includeGrades}
          isSignedIn={isAuthenticated}
          isResumed={isResumed}
          isConfirming={isConfirming}
          error={confirmError}
          onConfirm={() => void confirmProposal()}
          onCancel={() => {
            setProposal(null);
            setConfirmError(null);
            setIsResumed(false);
            // Discarding is discarding: the copy under this button promises
            // nothing was saved, and a record left behind would put the rows
            // back on the next visit.
            clearGuestProposal();
            pendingHandoff.current = null;
          }}
        />
      );
    }

    if (isReading) return <ReadingTranscript />;

    if (readError) {
      return (
        <ReadFailed
          message={readError}
          onRetry={() => setReadError(null)}
          onAddByHand={() => {
            setReadError(null);
            startManualAdd();
          }}
        />
      );
    }

    // An empty `rows` is what a failed read leaves behind, and the screen
    // below it is the first-run one: it would tell a reader whose list simply
    // did not arrive that they have taken nothing yet, and invite them to
    // import a transcript over a list nobody can see. A failed read is not an
    // empty list, so it says which of the two this is.
    if (isError) {
      return <ListFailed onRetry={() => void takenQuery.refetch()} />;
    }

    if (rows.length === 0) {
      return (
        <div className="flex justify-center px-5 pt-3.5 pb-10">
          <div className="w-full max-w-[480px]">
            <TranscriptDropZone
              variant="first"
              includeGrades={includeGrades}
              onIncludeGradesChange={setIncludeGrades}
              onFile={(file) => void readTranscript(file)}
              onAddByHand={startManualAdd}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-w-0 flex-1 flex-col px-5">
        <div className="border-cc-rule border-b pt-5 pb-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <p className="m-0 text-[13.5px] text-cc-muted">
              <span className="font-semibold text-cc-ink tabular-nums">
                {rows.length}
              </span>{" "}
              {rows.length === 1 ? "course" : "courses"}
            </p>
            <div className="flex min-w-0 flex-col items-end gap-1.5">
              <button
                type="button"
                onClick={() => setUpdateOpen(true)}
                className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[9px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-chip-ink hover:border-cc-hov"
              >
                <RefreshCw size={15} strokeWidth={1.9} aria-hidden />
                Update transcript
              </button>
              <span className="whitespace-nowrap text-[12px] text-cc-dim2">
                {lastImport
                  ? `Last read ${readDate(lastImport)}`
                  : "Added by hand"}
              </span>
            </div>
          </div>

          {banner ? (
            <output className="mt-4 flex items-start gap-[11px] rounded-[11px] border border-cc-success/40 bg-cc-surface px-[15px] py-[13px]">
              <CircleCheck
                size={16}
                strokeWidth={2.1}
                aria-hidden
                className="mt-px flex-none text-cc-success"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[13.5px] text-cc-success">
                  {banner}
                </span>
                <span className="mt-1 block text-[12.5px] text-cc-muted leading-[1.5]">
                  Courses already in your list kept the edits you made.
                </span>
              </span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                aria-label="Dismiss"
                className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-[6px] text-[16px] text-cc-success leading-none"
              >
                ×
              </button>
            </output>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-[18px] pt-[18px]">
          {reviewsKnown ? (
            <UnreviewedCard
              courses={unreviewed.map((course) => ({
                code: course.courseCode,
                name: course.name,
              }))}
              line={
                unreviewed.length === 1
                  ? "You have 1 unreviewed course."
                  : `You have ${unreviewed.length} unreviewed courses.`
              }
              onStart={() => openReviewer()}
              onSelect={(courseCode) => openReviewer(courseCode)}
            />
          ) : null}

          <div className="scrollbar-subtle overflow-x-auto overflow-y-hidden rounded-[12px] border border-cc-rule bg-cc-surface">
            <div
              className={`${TAKEN_GRID} border-cc-rule border-b bg-cc-pg px-4 py-3.5 font-semibold text-[11px] text-cc-dim uppercase tracking-[0.06em]`}
            >
              {COLUMNS.map((column) => (
                <div
                  key={column}
                  className={column === "Actions" ? "text-right" : undefined}
                >
                  {column}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={startManualAdd}
              className="m-px flex w-[calc(100%-2px)] min-w-[600px] cursor-pointer items-center gap-2.5 rounded-[9px] border border-cc-brand/40 border-dashed bg-cc-brand/6 px-[15px] py-[11px] text-cc-brand hover:border-cc-brand hover:bg-cc-brand/11"
            >
              <Plus size={15} strokeWidth={2} aria-hidden />
              <span className="font-medium text-[13.5px]">
                Add a course by hand
              </span>
            </button>

            {rows.map((row) => (
              <TakenCourseRow
                key={row.courseCode}
                row={row}
                isReviewed={
                  reviewsKnown ? !unreviewedCodes.has(row.courseCode) : null
                }
                isBusy={isBusy}
                onSave={(edits) => saveEdits(row, edits)}
                onRemove={() => setPendingRemove(row)}
              />
            ))}
          </div>
        </div>

        <p className="m-0 flex items-center gap-2 pt-[18px] pb-[26px] text-[11.5px] text-cc-dim2">
          <Info size={13} strokeWidth={1.9} aria-hidden className="flex-none" />
          Course Community is run by KTH AI Society, a student organisation.
          Credits and grades shown here are your own entries — not an official
          KTH record.
        </p>
      </div>
    );
  }

  return (
    <PageColumn>
      <PageHeader title="Taken courses" subtitle="Your completed courses." />
      {screen()}

      <AddTakenCourseDialog
        open={addOpen}
        takenCourseCodes={courseCodes}
        onClose={() => setAddOpen(false)}
        onAdd={addCourse}
      />

      {/*
        Mounted only while a row is pending, so the confirmation can name the
        course it is about rather than holding a dialog open over nothing.
      */}
      {pendingRemove ? (
        <RemoveTakenCourseDialog
          row={pendingRemove}
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            const row = pendingRemove;
            setPendingRemove(null);
            removeCourse(row);
          }}
        />
      ) : null}

      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent
          showCloseButton={false}
          className="cc-theme w-[460px] max-w-[calc(100vw-2rem)] gap-0 rounded-[14px] bg-cc-surface p-[22px] text-cc-ink shadow-[0_18px_48px_rgba(20,30,45,0.26)]"
        >
          <DialogTitle className="font-semibold text-[19px] leading-[1.25]">
            Read a newer transcript
          </DialogTitle>
          <DialogDescription className="sr-only">
            Upload a newer Ladok Resultatintyg. Nothing is saved until you
            confirm what it read.
          </DialogDescription>
          <div className="mt-3.5">
            <TranscriptDropZone
              variant="update"
              includeGrades={includeGrades}
              onIncludeGradesChange={setIncludeGrades}
              onFile={(file) => void readTranscript(file)}
              lastReadLine={
                lastImport ? `Last read ${readDate(lastImport)}` : null
              }
              onCancel={() => setUpdateOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/*
        The artboard draws this gate as a screen of the page (`isAuth`,
        `… - Taken Courses.dc.html`). It is a dialog here because that is
        what the sign-in surface is everywhere else in this app — `auth.tsx`
        records that the design's own sign-in is "a panel over the page it
        interrupted" — and because `AuthReasonDialog` already carries the two
        halves the artboard's screen only mimes: a `callbackURL` that comes back
        to `/taken`, and the email path, which cannot stay in this document at
        all. Its kicker and title are the artboard's, word for word.
      */}
      <AuthReasonDialog
        reason={authReason}
        onReasonChange={setAuthReason}
        onClose={() => setAuthReason(null)}
        /*
          Back to `/taken`, carrying the handoff token when a proposal is
          waiting for this sign-in. The mapper exists because the URL stops
          saying something the caller still knows — the review draft uses it to
          put back an `?open=` that was spent on arrival — and here what it puts
          back is the one thing that makes the resume this reader's rather than
          the next person's at this browser.
        */
        returnTo={() =>
          pendingHandoff.current === null
            ? "/taken"
            : withHandoff("/taken", pendingHandoff.current)
        }
      />
    </PageColumn>
  );
}

/** The artboard's `isParsing` screen. Nothing has been written at this point. */
function ReadingTranscript() {
  return (
    <div className="flex justify-center px-5 pt-[30px] pb-10">
      <div className="w-full max-w-[520px]">
        <h2 className="m-0 font-semibold text-[22px] leading-[1.2] tracking-[-0.015em]">
          Reading your transcript
        </h2>
        <p className="m-0 mt-2 text-[13.5px] text-cc-muted">
          Nothing is saved until you confirm.
        </p>
        <output
          aria-label="Reading your transcript"
          className="mt-5 block h-1.5 overflow-hidden rounded-full bg-cc-pill"
        >
          <span className="block h-full w-1/3 animate-pulse rounded-full bg-cc-btn" />
        </output>
      </div>
    </div>
  );
}

/**
 * The artboard's `isFailed` screen. It says outright that nothing was saved,
 * because nothing was: the parse is a read and the write is a separate call
 * that this path never reaches.
 */
function ReadFailed({
  message,
  onRetry,
  onAddByHand,
}: {
  message: string;
  onRetry: () => void;
  onAddByHand: () => void;
}) {
  return (
    <div className="flex justify-center px-5 pt-[18px] pb-10">
      <div className="w-full max-w-[620px]">
        <div className="flex items-center gap-2.5">
          <span className="flex size-[26px] items-center justify-center rounded-full bg-cc-danger/12 text-cc-danger">
            <FileWarning size={15} strokeWidth={2.2} aria-hidden />
          </span>
          <p className="m-0 font-semibold text-[11px] text-cc-danger uppercase tracking-[0.09em]">
            Reading failed
          </p>
        </div>
        <h2 className="m-0 mt-3 font-semibold text-[22px] leading-[1.2] tracking-[-0.015em]">
          {READ_FAILED_TITLE}
        </h2>
        <p
          role="alert"
          className="m-0 mt-2 text-[14px] text-cc-muted leading-[1.55]"
        >
          {message}
        </p>
        <p className="m-0 mt-4 flex items-center gap-3 rounded-[12px] border border-cc-danger/30 bg-cc-surface px-4 py-3.5 text-[13px] text-cc-ink2">
          <span className="flex-1">
            Download the certificate straight from Ladok rather than scanning it
            — if no text selects in the PDF, it is a scan and there is nothing
            to read.
          </span>
          <span className="flex-none font-medium text-[12.5px] text-cc-danger">
            Nothing was saved
          </span>
        </p>
        <div className="mt-[18px] flex items-center gap-[11px]">
          <button
            type="button"
            onClick={onRetry}
            className="flex h-11 cursor-pointer items-center rounded-[9px] bg-cc-btn px-5 font-semibold text-[14px] text-cc-btn-fg hover:opacity-[0.88]"
          >
            Try another file
          </button>
          <button
            type="button"
            onClick={onAddByHand}
            className="flex h-11 cursor-pointer items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-4 font-medium text-[13.5px] text-cc-chip-ink hover:border-cc-hov"
          >
            Add courses manually
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The read of `taken.list` did not come back.
 *
 * It says outright that nothing was changed, because nothing was: the list is
 * a read. It offers no transcript drop zone — an import planned against a list
 * this page cannot see is exactly the overwrite `confirmProposal` re-reads to
 * avoid — so the one thing on offer is reading the list again.
 */
function ListFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex justify-center px-5 pt-[30px] pb-10">
      <div className="w-full max-w-[520px]">
        <div className="flex items-center gap-2.5">
          <span className="flex size-[26px] items-center justify-center rounded-full bg-cc-danger/12 text-cc-danger">
            <FileWarning size={15} strokeWidth={2.2} aria-hidden />
          </span>
          <p className="m-0 font-semibold text-[11px] text-cc-danger uppercase tracking-[0.09em]">
            Could not load
          </p>
        </div>
        <h2 className="m-0 mt-3 font-semibold text-[22px] leading-[1.2] tracking-[-0.015em]">
          Your taken courses did not load
        </h2>
        <p
          role="alert"
          className="m-0 mt-2 text-[14px] text-cc-muted leading-[1.55]"
        >
          The request for your course list did not come back, so this page
          cannot say what is in it. Nothing is lost — this is a read, and
          nothing of yours was changed.
        </p>
        <div className="mt-[18px] flex items-center gap-[11px]">
          <button
            type="button"
            onClick={onRetry}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-[9px] bg-cc-btn px-5 font-semibold text-[14px] text-cc-btn-fg hover:opacity-[0.88]"
          >
            <RefreshCw size={15} strokeWidth={1.9} aria-hidden />
            Try again
          </button>
          <Link
            href="/search"
            className="flex h-11 items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-4 font-medium text-[13.5px] text-cc-chip-ink no-underline hover:border-cc-hov"
          >
            Browse courses instead
          </Link>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden className="px-5 pt-5">
      <div className="h-[300px] animate-pulse rounded-[12px] border border-cc-rule bg-cc-surface" />
    </div>
  );
}
