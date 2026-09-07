"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { type AuthReason, AuthReasonDialog, useMe } from "@/features/auth";
import {
  CollectionsBody,
  CollectionsStrip,
  useCollectionsState,
} from "@/features/collections";
import {
  CourseCardItem,
  NO_COURSE_STATS,
  useCourseStats,
  useCourseSummaries,
} from "@/features/courses";
import { PageColumn, PageHeader } from "@/features/shell";
import {
  type OpenCourseRequest,
  useWorkspaceHost,
  WorkspaceHost,
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

/**
 * The viewer's saved courses.
 *
 * From `docs/design_ref/2026-09-06/Course Community - Saved.dc.html`. Four things
 * about it are worth knowing before changing anything here.
 *
 * **It hosts the workspace pane, so its cards ramp.** The artboard imports the
 * pane with the same contract Explore uses, and computes the card's `geo` from
 * what the pane leaves of the row exactly as Explore does — which is why both
 * pages get all of it from one `useWorkspaceHost` call. So the geometry is
 * measured rather than pinned: with no tab open the column is wide and the ramp
 * lands on its expanded end, and with a tab open the cards collapse instead of
 * overflowing a column that just lost 504px. Pinning either end here — as a
 * page with no pane to yield to could — is what the artboard's interpolation
 * replaces.
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
 * emptying.
 *
 * **Collections is part of this page, not a link away from it.** The artboard
 * imports the Collections artboard as a section of itself, which is the
 * design's only way in to collections — its rail has no entry for them. Since
 * #208 that import arrives in two pieces rather than one: `CollectionsStrip` is
 * this page's band, and `CollectionsBody` is what sits under it in the column.
 * Opening a collection from the chips opens its detail *here*, and the saved
 * list gets out of its way, which is the artboard's own
 * `showSavedSection: !collectionsOpenDetail`. It is also why a course opened
 * from inside a collection comes back to this route as `?open=`: the pane it
 * opens into is this page's.
 *
 * **The list is every saved course, organized or not.** A collection is a view
 * over saved courses, never a place they move to (`CONTEXT.md`): joining one
 * takes nothing out of this list, and a course may be in several at once. The
 * chips above **narrow** the list — opening one swaps this list for that
 * collection's — rather than relocating anything out of it. The artboard says
 * the same thing: `savedCards` over every saved code and `hasSaved`, with no
 * "Every saved course is in a collection" panel, because there is no state in
 * which this list can be empty while saves exist. There is deliberately no
 * organized/unorganized split.
 *
 * **Neither section carries a heading.** There is no "Saved courses" `h2` and
 * no "Collections" one either, and that is an alignment decision rather than an
 * editorial one (#208 Q7). Explore has nothing between its band and its
 * results, so any heading left here would push this list down and the two pages
 * would stop matching one row *below* the band as well as at it — levelling the
 * tab strips and then leaving a heading in the column fixes one row and breaks
 * the next. The `h1` and its subtitle carry the page. Both sections take an
 * `aria-label` instead, so neither region loses its name.
 *
 * ## Where else it departs from the artboard
 *
 * ### The collections strip is above the row — and its detail is not (#208)
 *
 * The artboard keeps the collections strip *above* the row the pane sits in.
 * This page used to keep the whole of collections *inside* the results column
 * instead, for a reason that has not changed: a fixed-height block above a row
 * that owns the page's only scroll clips a long open collection.
 *
 * #208 splits the difference, and it is a split rather than a reversal. The
 * **chips** move up into the band, where the artboard always had them; the
 * **detail** stays in the scrolling column, for the clipping reason above. Both
 * halves of the old note survive. `CollectionsStrip` and `CollectionsBody` are
 * that split, fed by one `useCollectionsState` call so there is still only one
 * writer on `?collection=`.
 *
 * ### The band fills the height it used to reserve
 *
 * `--cc-search-block-h` is what Explore spends on its search block, and #205
 * had this page hold the same height *blank* above its row so the two tab
 * strips started level. The band now fills it. The token keeps its derivation
 * and stops meaning "the height Saved reserves"; on both pages it now means
 * "the height of the band". Measured on a 1920px viewport: `PageHeader` ends at
 * y=155 on both routes, the band runs 155→229, and both pages' workspace panes
 * start at y=229.
 *
 * ### The band does not take the rail correction
 *
 * The artboard shortens its strip by a flat 236px while tabs are open
 * (`savedTopMargin`, line 961) — the **rail's width**, which is what the same
 * number means in the Explore artboard's `searchBarMargin`. The two do
 * different things with it, which is why only one of them is built. Explore's
 * band is centred, so a right margin of a rail width moves its bar onto the
 * viewport's centre line. This band is left-aligned — chips from the left, the
 * create button pinned right — so the same margin would centre nothing and only
 * cut 236px off its right-hand end, when the two bands are meant to occupy the
 * same box. Measured: this band and the row below it both run 490→1666.
 * `resultsMax` is computed by the artboard and never read by its markup, so
 * there is nothing to follow there either.
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

  const host = useWorkspaceHost("saved");
  const { containerRef, geo, resultsRef, rowRef, workspace } = host;

  /**
   * The collections feature, in one call, shared by the two places this page
   * puts it: the band above the row and the column inside it.
   *
   * **Once**, deliberately. The hook writes `?collection=` and two callers
   * would be two writers on one URL. It is also why the open collection is read
   * off `collections.openId` here rather than reported back through a callback
   * — `onDetailChange` existed because the old single component was the only
   * thing that knew, and now this page knows.
   *
   * `geo` is handed down because an open collection's cards sit in this very
   * column: without it they pinned the expanded end and were clipped by the
   * column the pane had just narrowed.
   */
  const collections = useCollectionsState({
    openCollectionId,
    onRequestAuth: setAuthReason,
    geo,
  });
  const openDetail = collections.openId;

  const requestedCode = openCourse?.courseCode ?? null;
  const requestedKind = openCourse?.kind ?? null;
  const openTab = workspace.open;

  /**
   * The request this page has already acted on, so it acts on it exactly once.
   *
   * The unbounded render loop this could feed is closed at the value instead:
   * `openCourse` returns the very same `Workspace` for a no-op open, so
   * `useState` bails out rather than re-rendering this component and sending the
   * effect below round again through a dependency — `router` — whose identity is
   * not stable. See `features/workspace/lib/open-courses.ts`.
   *
   * The guard is belt-and-braces. What it defends against
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
   * (`… - Saved.dc.html`). They are never merged for display: a reader who
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

      {/*
        The band, at exactly the height Explore's search block spends between
        its header and its row — which is what puts the two pages' workspace tab
        strips on the same line. #205 held this height blank here; #208 fills it
        with the collections the reader actually has.
      */}
      <CollectionsStrip state={collections} />

      {/*
        The artboard's row: the results column, and the pane beside it. It
        starts immediately under the band, with no reservation of its own left
        to make — the band is the reservation now.
      */}
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

          {/*
            What sits under the band: the confirmation note, and an open
            collection's detail. The chips themselves are up in the band; this
            is the half that has to stay inside the column, because the column
            owns the page's only scroll and a long collection has to be
            scrollable. It names its own region and collapses to nothing —
            padding included — when there is neither a note nor an open detail.
          */}
          <CollectionsBody state={collections} embedded />

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
              /*
                Named rather than headed. The artboard's own `h2` and its line
                came out in #208: Explore has nothing between its band and its
                results, so a heading here would push this list one row below
                Explore's and undo the levelling the band above just bought. The
                `h1` says "Saved courses" already; this only has to name the
                region for a screen reader.
              */
              aria-label="Saved courses"
              className="flex flex-col gap-3.5 pt-[18px] pb-5 @max-[440px]:gap-3 @max-[440px]:pt-3"
            >
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

        {/* The pane, or the sheet, or neither — `WorkspaceHost` owns that
            branch for both pages. It sits inside the row because that is where
            the column is laid out; the sheet portals out of here. */}
        <WorkspaceHost host={host} />
      </div>

      {/*
        Asked before the write, not confirmed after it. The body names
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
