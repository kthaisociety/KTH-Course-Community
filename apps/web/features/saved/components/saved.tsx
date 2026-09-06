"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { type AuthReason, AuthReasonDialog, useMe } from "@/features/auth";
import { Collections } from "@/features/collections";
import {
  CourseCardItem,
  courseCardGeometry,
  NO_COURSE_STATS,
  useCourseStats,
  useCourseSummaries,
} from "@/features/courses";
import { PageColumn, PageHeader } from "@/features/shell";
import {
  MobileWorkspaceSheetHost,
  type OpenCourseRequest,
  useResultsWidth,
  useWorkspacePane,
  useWorkspacePresentation,
  WorkspacePaneHost,
} from "@/features/workspace";
import { useSetCourseSaved } from "../api/mutations";
import { toggleGuestSave, useGuestSavesImport } from "../hooks/use-guest-saves";
import { GuestSavesImportBanner } from "./guest-saves-import-banner";

/**
 * How many card-shaped placeholders stand in while the list loads. The count is
 * arbitrary — the real one is not known until `user.me` answers — so it is the
 * shortest run that reads as a list rather than as a single stalled card.
 */
const SKELETON_KEYS = ["s0", "s1", "s2"] as const;

/** Names the saved list's own section, under the page's `h1` of the same words. */
const SAVED_HEADING_ID = "saved-courses-heading";

/**
 * The viewer's saved courses.
 *
 * From `docs/design_ref/2026-09-06/Course Community - Saved.dc.html`. Four things
 * about it are worth knowing before changing anything here.
 *
 * **It hosts the workspace pane, so its cards ramp.** The artboard imports the
 * pane at line 161 with the same contract Explore uses, and computes the card's
 * `geo` from what the pane leaves of the row (line 836) exactly as Explore
 * does. So the geometry is measured here rather than pinned: with no tab open
 * the column is wide and the ramp lands on its expanded end, which is the fixed
 * object this page used to hand out, and with a tab open the cards collapse
 * instead of overflowing a column that just lost 504px. #90's "Saved pins the
 * card's `geo` to the fully collapsed end" was decided when this page had no
 * pane to yield to; it has one now, and the artboard interpolates.
 *
 * **Unsaving removes the save and its collection memberships, and nothing
 * else.** The trash control calls `saved.unsave`, whose repository deletes one
 * `user_saved_courses` row; taken history and reviews have no foreign key to
 * it, so nothing on this screen may imply they go with it — no optimistic write
 * that reaches into `taken.list` or the review cache, and no copy that says so.
 * `saved.spec.tsx` holds that. `collection_courses` *does* hang off that row,
 * with `on delete cascade`, so an unsave does take the course out of every
 * collection it was in and out of each of their orders. That is what the
 * confirmation below names, and now that this list shows organized courses too
 * it is a thing a reader can do without ever opening the collection they are
 * emptying (#155).
 *
 * **Collections is a section of this page, not a link away from it.** The
 * artboard imports the Collections artboard at line 82 with `compact`, which is
 * the design's only way in to collections — its rail has no entry for them, and
 * #91's stopgap rail link went when this landed. Opening a collection from the
 * chips opens its detail *here*, and the saved list gets out of its way, which
 * is the artboard's own `showSavedSection: !collectionsOpenDetail`. It is also
 * why a course opened from inside a collection comes back to this route as
 * `?open=`: the pane it opens into is this page's.
 *
 * **The list is every saved course, organized or not.** A collection is a view
 * over saved courses, never a place they move to (`CONTEXT.md`): joining one
 * takes nothing out of this list, and a course may be in several at once. The
 * chips above **narrow** the list — opening one swaps this list for that
 * collection's — rather than relocating anything out of it. The artboard says
 * the same thing at lines 129-135: `savedCards` over every saved code and
 * `hasSaved` where the previous export had `unorganized` and `hasUnorganized`,
 * and no "Every saved course is in a collection" panel, because there is no
 * state in which this list can be empty while saves exist. #156 settled it;
 * #90's deferral and the split it deferred are both gone.
 *
 * The `h2` comes back with the subtitle that earns it. It repeats the `h1`, and
 * that is the artboard's own doing — but the section under it is now one of two
 * on the page, and the line beneath is what tells them apart.
 *
 * ## Where else it departs from the artboard
 *
 * The artboard keeps the collections strip *above* the row the pane sits in,
 * and shortens it by a flat 236px while tabs are open (`savedTopMargin`, line
 * 961). Here the strip is inside the column the pane already narrows, which
 * does the same job exactly rather than approximately — and, decisively, keeps
 * an open collection's detail scrollable. A fixed-height block above a row that
 * owns the page's only scroll would clip a long collection instead.
 * `resultsMax` (line 962) is computed by the artboard and never read by its
 * markup, so there is nothing to follow.
 */
type Props = {
  /**
   * The collection named by `?collection=` on this route, if any. Opening one
   * from the chips writes it here, so a refresh or a shared link lands back on
   * the same detail — `Collections` keeps the route in step itself.
   */
  openCollectionId?: string | null;
  /**
   * The course named by `?open=` on this route, if any.
   *
   * A one-shot instruction rather than a piece of page state: the collection
   * detail's cards navigate here with it, since the pane a course opens into is
   * this page's and not theirs. It is consumed on arrival and taken back out of
   * the URL, so a reload does not reopen a tab the reader closed.
   */
  openCourse?: OpenCourseRequest | null;
};

export function Saved({ openCollectionId = null, openCourse = null }: Props) {
  const router = useRouter();
  const { user, isLoading: isSessionLoading } = useMe();
  const { setSaved } = useSetCourseSaved();
  // The signed-out reader's list, and the hand-off that moves it into an
  // account once they have one. Held here rather than inside the banner so the
  // list below can read the same codes the banner is offering to import.
  const guestImport = useGuestSavesImport();
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);
  /**
   * The course an unsave has been asked about and not yet answered.
   *
   * The code alone is enough — the card is what names the course on screen, and
   * the dialog says the code back. It is cleared by answering either way, so a
   * card that leaves the list while the question is up cannot leave a write
   * armed behind it.
   */
  const [pendingUnsave, setPendingUnsave] = useState<string | null>(null);
  // Which collection's detail is open, as `Collections` reports it. The route
  // is the authority on the first paint; after that the chips are.
  const [openDetail, setOpenDetail] = useState<string | null>(openCollectionId);
  useEffect(() => setOpenDetail(openCollectionId), [openCollectionId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const presentation = useWorkspacePresentation(containerRef);
  const workspace = useWorkspacePane();
  const [resultsRef, resultsWidth] = useResultsWidth();
  const geo = courseCardGeometry(resultsWidth);

  const requestedCode = openCourse?.courseCode ?? null;
  const requestedKind = openCourse?.kind ?? null;
  const openTab = workspace.open;

  /**
   * The request this page has already acted on, so it acts on it exactly once.
   *
   * This used to be load-bearing, and said so. `openCourse` was not idempotent
   * at the state level — re-opening a tab that was already open and already in
   * front still returned a *new* workspace — so every run of the effect below
   * re-rendered this component, and any dependency whose identity is not stable
   * across that render sent the effect round again immediately. `router` is
   * exactly such a dependency. That was an unbounded loop allocating a workspace
   * per turn, and it surfaced as an out-of-memory crash rather than as a failed
   * assertion. #154 fixed it at the value: a no-op open now returns the very
   * same `Workspace`, `useState` bails out, and the loop has no fuel.
   *
   * The guard stays, demoted to belt-and-braces. What it still defends against
   * is a *second* instruction rather than the loop — the same `?open=` surviving
   * one more render before `router.replace` has taken it back out of the URL
   * would reopen a tab the reader may already have closed. Next's `router` is
   * stable in practice; nothing promises it, and a test double that returns
   * `{ push, replace }` per call is not.
   *
   * Clearing it when the request goes away is what keeps it a one-shot rather
   * than a once-ever: the same course opened from a collection a second time is
   * a new instruction, and by then `?open=` has been out of the URL in between.
   */
  const spentRequest = useRef<string | null>(null);

  /*
   * `?open=` says "open this", not "this is open", so it is spent and then
   * cleared. `?collection=` is the one parameter this route carries as state,
   * and it is rebuilt rather than read back off the URL: a bare `router.replace`
   * to `/saved` would close the detail the reader is standing in.
   *
   * Only primitives are watched. The pair arrives as a fresh object from the
   * server on every render of this route, so an effect keyed on the object
   * would see a change that never happened.
   */
  useEffect(() => {
    if (!requestedCode || !requestedKind) {
      spentRequest.current = null;
      return;
    }
    const request = `${requestedKind}:${requestedCode}`;
    if (spentRequest.current === request) return;
    spentRequest.current = request;

    openTab(requestedCode, requestedKind);
    router.replace(
      openCollectionId
        ? `/saved?collection=${encodeURIComponent(openCollectionId)}`
        : "/saved",
      { scroll: false },
    );
  }, [requestedCode, requestedKind, openTab, router, openCollectionId]);

  const signedIn = user !== null;
  /**
   * The list this page draws.
   *
   * For a member, `user.me` rather than `saved.list`: the two return the same
   * codes, and the card's own Save state already reads this one. A second copy
   * would mean an unsave that empties one and leaves the other holding the
   * course.
   *
   * For a guest, the browser's own list. These are the artboard's `acctSaves`
   * and `localSaves`, and `savedVals` picks between them by exactly this test
   * (`… - Saved.dc.html:517`). They are never merged for display: a reader who
   * has just signed in sees their account, and the banner above offers them the
   * browser list separately rather than showing a total that is not stored
   * anywhere.
   */
  const savedCourseCodes = signedIn
    ? (user?.savedCourseCodes ?? [])
    : guestImport.guestCodes;
  const summaries = useCourseSummaries(savedCourseCodes, !isSessionLoading);
  const { data: stats } = useCourseStats(savedCourseCodes, !isSessionLoading);

  const courses = summaries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  const isLoading =
    isSessionLoading ||
    (savedCourseCodes.length > 0 && summaries.some((query) => query.isPending));
  /**
   * Saves whose course would not load. They are still saved — the row is in
   * `user_saved_courses`, only `course.summary` did not answer — so they are
   * counted and said out loud rather than dropped from the list, and a page
   * where every one of them failed must never fall through to "No saved
   * courses yet". An empty list and an unreadable one are different pictures.
   */
  const unreadable = savedCourseCodes.length - courses.length;

  /** Unsaves the course the reader confirmed, and closes the question. */
  function onConfirmUnsave() {
    const courseCode = pendingUnsave;
    setPendingUnsave(null);
    if (!courseCode) return;

    // A guest's list is in this browser, so removing from it is a local write
    // that cannot fail against a server and has nothing to roll back.
    if (!signedIn) {
      toggleGuestSave(courseCode, false);
      return;
    }

    setSaved(courseCode, false).catch(() =>
      toast.error(`Could not remove ${courseCode} from your saved courses.`),
    );
  }

  return (
    <PageColumn
      className="h-full min-h-0 overflow-hidden"
      contentClassName="h-full min-h-0 pb-0"
      containerRef={containerRef}
    >
      {/*
        The artboard's subtitle ends "…organize them into groups for
        collections". #68 decision 1 retires "comparison" from the copy as well
        as from the identifiers, and the artboard's revised line still reads as
        a half-finished substitution, so this names what the groups actually
        are.
      */}
      <PageHeader
        title="Saved courses"
        subtitle="Keep track of courses you are interested in and organize them into collections."
      />

      {/* The artboard's row: the results column, and the pane beside it. */}
      <div
        ref={rowRef}
        className="flex min-h-0 flex-1 gap-[18px] px-7 pb-5 @max-[440px]:px-[14px]"
      >
        <div
          ref={resultsRef}
          data-testid="saved-results"
          className="scrollbar-hidden min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
        >
          {/* The hand-off sits above the collections row, which is where the
              artboard puts it — its four rows are the first thing in the
              results column, before `showSavedSection`. */}
          <div className="pt-[18px] empty:hidden @max-[440px]:pt-3">
            <GuestSavesImportBanner
              signedIn={signedIn}
              guestCodes={guestImport.guestCodes}
              state={guestImport.state}
              onRun={() =>
                void guestImport.run({
                  accountCodes: user?.savedCourseCodes ?? [],
                  save: (courseCode) => setSaved(courseCode, true),
                })
              }
              onDismiss={guestImport.dismiss}
            />
          </div>

          {/* The artboard's `18px 28px 10px`, narrowing with the list below it. */}
          <div className="pt-[18px] pb-2.5 @max-[440px]:pt-3">
            <Collections
              compact
              openCollectionId={openCollectionId}
              onDetailChange={setOpenDetail}
              onRequestAuth={setAuthReason}
              /*
                An open collection's cards sit in this very column, so they get
                the ramp this page already measured for its own list. Without it
                they pinned the expanded end and were clipped by the column the
                pane had just narrowed (#159).
              */
              geo={geo}
            />
          </div>

          {/*
            Desktop is the Saved artboard's own `18px 28px 20px` with a 14px
            gap. The narrow end is the Mobile Preview's `12px 14px 20px` and
            12px, and it is a container query on `PageColumn` rather than a
            viewport one, at the same 440px the card uses to drop its own button
            labels. The side padding is the row's; only the rhythm is here.

            Hidden while a collection's detail is open, which is the artboard's
            `showSavedSection: !this.state.collectionsOpenDetail` — the detail is
            itself a list of these cards, and two of them would be one page
            showing the same course twice.
          */}
          {openDetail !== null ? null : (
            <section
              aria-labelledby={SAVED_HEADING_ID}
              className="flex flex-col gap-3.5 pt-[18px] pb-5 @max-[440px]:gap-3 @max-[440px]:pt-3"
            >
              {/*
                The artboard's own heading and line, at lines 129-131. The line is
                the whole of what #156 settled, said to the reader: a collection
                groups saved courses, it does not take them out of this list.
              */}
              <div>
                <h2
                  id={SAVED_HEADING_ID}
                  className="m-0 font-semibold text-[16px] leading-[1.3]"
                >
                  Saved courses
                </h2>
                <div className="mt-1 text-[12.5px] text-cc-muted">
                  All the courses you have saved, including any already grouped
                  into a collection.
                </div>
              </div>

              {isLoading ? (
                SKELETON_KEYS.map((key) => <CardSkeleton key={key} />)
              ) : savedCourseCodes.length === 0 ? (
                <div className="rounded-[11px] border border-cc-rule bg-cc-surface p-6 text-center">
                  <div className="font-semibold text-[14.5px]">
                    No saved courses yet
                  </div>
                  <div className="mt-[5px] text-[12.5px] text-cc-muted">
                    Explore courses and save the ones you want to revisit.
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/search")}
                    className="mx-auto mt-[13px] flex h-[34px] w-max cursor-pointer items-center rounded-[9px] bg-cc-btn px-3.5 font-semibold text-[13px] text-cc-btn-fg hover:opacity-90"
                  >
                    Explore courses
                  </button>
                </div>
              ) : (
                <>
                  {unreadable > 0 ? (
                    // The artboard's note row, in the palette's danger colour, and an
                    // `<output>` because that is the element with the status role the
                    // artboard's own `aria-live` note asks for. It says the courses
                    // are still saved, because they are: nothing here unsaves
                    // anything.
                    <output className="block rounded-[9px] border border-cc-danger/40 bg-cc-surface px-[13px] py-[9px] text-[12.5px] text-cc-danger">
                      {unreadable === 1
                        ? "1 saved course could not be loaded. It is still saved — reload to try again."
                        : `${unreadable} saved courses could not be loaded. They are still saved — reload to try again.`}
                    </output>
                  ) : null}
                  <ul className="m-0 flex list-none flex-col gap-3.5 p-0 @max-[440px]:gap-3">
                    {courses.map((course) => (
                      <li key={course.courseCode}>
                        <CourseCardItem
                          course={course}
                          stats={stats[course.courseCode] ?? NO_COURSE_STATS}
                          geo={geo}
                          action="add"
                          // Every card on this page is one the reader already saved,
                          // so the split Save button has nothing left to offer and
                          // the picker stands alone; removal is the trash control.
                          removeLabel={`Remove ${course.courseCode} from saved courses`}
                          onRemove={() => setPendingUnsave(course.courseCode)}
                          onOpen={() =>
                            workspace.open(course.courseCode, "details")
                          }
                          onReview={() =>
                            workspace.open(course.courseCode, "review")
                          }
                          /*
                            A deliberate deviation: the Saved artboard leaves
                            the Course Card's `pickerAbove` at its default, and
                            this page passes it anyway. The reason is a property
                            of the page rather than of the drawing — the saved
                            list is a single scrolling column, and a panel
                            dropping out of the last card falls out of a box
                            that is `overflow-x-hidden`. Matching the artboard
                            here would reintroduce that.
                          */
                          pickerAbove
                          onRequestAuth={setAuthReason}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>

        {/* Two presentations of one open list, and never both at once — the
            column until the container has been measured as narrow, the sheet
            after. See `useWorkspacePresentation` for why `null` is not
            "narrow". */}
        {presentation === "sheet" ? null : (
          <WorkspacePaneHost
            rowRef={rowRef}
            openCourses={workspace.openCourses}
            activeId={workspace.activeId}
            onActivate={workspace.activate}
            onClose={workspace.close}
            onOpen={workspace.open}
          />
        )}
      </div>

      {presentation === "sheet" ? (
        <MobileWorkspaceSheetHost
          openCourses={workspace.openCourses}
          activeId={workspace.activeId}
          onClose={workspace.close}
          onOpen={workspace.open}
        />
      ) : null}

      {/*
        Asked before the write, not confirmed after it (#155). The body names
        the one thing an unsave really does take with it — the course's place in
        every collection holding it, cascaded off `user_saved_courses` — and
        says nothing about reviews or taken history, which have no foreign key
        to that row and are not touched.
      */}
      <ConfirmDialog
        request={
          pendingUnsave
            ? {
                eyebrow: "Saved courses",
                title: `Remove ${pendingUnsave} from your saved courses?`,
                body: `${pendingUnsave} leaves this list and any collection it is in, together with its place in their order. Your reviews and the courses you have marked as taken are untouched. You can save it again from Explore.`,
                cancelLabel: "Keep it saved",
                actionLabel: "Remove course",
              }
            : null
        }
        onCancel={() => setPendingUnsave(null)}
        onConfirm={onConfirmUnsave}
      />

      {/*
        Nothing redirects a signed-out reader away from this page, so its
        controls ask for a session themselves rather than failing silently —
        the same prompt they raise everywhere else in the app.
      */}
      <AuthReasonDialog
        reason={authReason}
        onReasonChange={setAuthReason}
        onClose={() => setAuthReason(null)}
      />
    </PageColumn>
  );
}

/** A card-shaped placeholder: the artboard's own 236px, and nothing inside it. */
function CardSkeleton() {
  return (
    <div
      aria-hidden
      className="h-[236px] animate-pulse rounded-[11px] border border-cc-rule bg-cc-surface"
    />
  );
}
