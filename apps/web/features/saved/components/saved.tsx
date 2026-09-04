"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  type AuthReason,
  AuthReasonDialog,
  useMe,
  useRequireSession,
} from "@/features/auth";
import {
  CourseCardItem,
  EXPANDED_CARD_GEOMETRY,
  NO_COURSE_STATS,
  useCourseStats,
  useCourseSummaries,
} from "@/features/courses";
import { PageColumn, PageHeader } from "@/features/shell";
import { useSetCourseSaved } from "../api/mutations";

/**
 * How many card-shaped placeholders stand in while the list loads. The count is
 * arbitrary — the real one is not known until `user.me` answers — so it is the
 * shortest run that reads as a list rather than as a single stalled card.
 */
const SKELETON_KEYS = ["s0", "s1", "s2"] as const;

/**
 * The viewer's saved courses.
 *
 * From `docs/design/Course Community - Saved.dc.html`. Three things about it
 * are worth knowing before changing anything here.
 *
 * **The geometry is pinned to the expanded end, and both issues say collapsed.**
 * Explore interpolates `geo` from the width its workspace pane leaves behind;
 * this page has no pane to yield to, so it hands every card one fixed object.
 * Which object is a contradiction someone has to settle. #90 says "Saved pins
 * the card's `geo` to the **fully collapsed end**" and #68's body says the same;
 * the artboard's own `geo` literal (line 721) is the *expanded* end — every
 * field of `EXPANDED_CARD_GEOMETRY` except `summaryMax`, which it sets to 57px
 * where the ramp tops out at 38px, and `reviewPad`, which the card's markup does
 * not read. The artboard wins here because #68's precedence rule gives it
 * layout, and because the collapsed end only exists to make room for a pane this
 * page does not have: a card cropped to no labels and no summary in a 1216px
 * column would be collapsing around nothing. The 57px is left as the ramp's
 * 38px rather than hand-built, since #68 decision 3 leaves the summary section
 * empty until something writes it — see the PR for #90.
 *
 * **Unsaving removes the save and nothing else.** The trash control calls
 * `saved.unsave`, whose repository deletes one row; taken history and reviews
 * have no foreign key to it. Nothing on this screen may imply otherwise — no
 * "this will also remove…" confirmation, and no optimistic write that reaches
 * into `taken.list` or the review cache. `saved.spec.tsx` holds that.
 *
 * **The list is flat, and the artboard's is not.** The artboard puts a compact
 * Collections panel above the cards and then shows only the saved courses *not*
 * in a collection, under an `h2` reading "Saved courses" and the line "Courses
 * you have saved but not yet added to a comparison". #91 owns that panel and it
 * is not on the page yet, so the split alone would make a course vanish from
 * `/saved` the moment it joined a collection, under a subtitle asserting a
 * division the reader cannot see — and an `h2` repeating the `h1` directly above
 * it. This is a deferral, not a design change. **#91 must put all three back**
 * when it lands the panel: the `h2`, its subtitle, and `unorganized` filtered
 * against `collections.list`, with the artboard's "Every saved course is in a
 * comparison" panel for when that filter empties.
 */
export function Saved() {
  useRequireSession();
  const router = useRouter();
  const { user, isLoading: isSessionLoading } = useMe();
  const { setSaved } = useSetCourseSaved();
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);

  // `user.me` rather than `saved.list`: the two return the same codes, and the
  // card's own Save state already reads this one. A second copy would mean an
  // unsave that empties one and leaves the other holding the course.
  const savedCourseCodes = user?.savedCourseCodes ?? [];
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

  function unsave(courseCode: string) {
    setSaved(courseCode, false).catch(() =>
      toast.error(`Could not remove ${courseCode} from your saved courses.`),
    );
  }

  return (
    <PageColumn>
      {/*
        The artboard's subtitle ends "…organize them into groups for
        comparison". #68 decision 1 retires that word from the copy as well as
        from the identifiers, so it names what the groups actually are.
      */}
      <PageHeader
        title="Saved courses"
        subtitle="Keep track of courses you are interested in and organize them into collections."
      />

      {/*
        Desktop is the Saved artboard's own `18px 28px 20px` with a 14px gap.
        The narrow end is the Mobile Preview's `12px 14px 20px` and 12px, and it
        is a container query on `PageColumn` rather than a viewport one, at the
        same 440px the card uses to drop its own button labels.
      */}
      <div className="flex flex-col gap-3.5 px-7 pt-[18px] pb-5 @max-[440px]:gap-3 @max-[440px]:px-[14px] @max-[440px]:pt-3">
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
                    geo={EXPANDED_CARD_GEOMETRY}
                    action="add"
                    // Every card on this page is one the reader already saved,
                    // so the split Save button has nothing left to offer and
                    // the picker stands alone; removal is the trash control.
                    removeLabel={`Remove ${course.courseCode} from saved courses`}
                    onRemove={() => unsave(course.courseCode)}
                    onOpen={() =>
                      router.push(`/course/${course.courseCode}?from=saved`)
                    }
                    onReview={() =>
                      router.push(
                        `/course/${course.courseCode}?writeReview=1&from=saved`,
                      )
                    }
                    // The artboard opens every picker upwards on this page: a
                    // saved list is a single column with nothing beside it, so
                    // a panel dropping from the last card would fall off it.
                    pickerAbove
                    onRequestAuth={setAuthReason}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/*
        `proxy.ts` only checks that a session cookie exists, so a stale one
        reaches this page signed out. The card's controls then ask for a session
        the way they do everywhere else rather than failing silently.
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
