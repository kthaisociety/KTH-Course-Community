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
 * From `docs/design/Course Community - Saved.dc.html`. Two things about it are
 * worth knowing before changing anything here.
 *
 * **The geometry is pinned, not ramped.** Explore interpolates `geo` from the
 * width its workspace pane leaves behind; this page has no pane to yield to, so
 * it hands every card the same object. #68's body says Saved pins the *fully
 * collapsed* end, and its own artboard passes the fully expanded one — the
 * `geo` literal at line 721 is `EXPANDED_CARD_GEOMETRY` field for field. #68's
 * precedence rule makes the artboard the authority on layout, so the expanded
 * end is what is pinned here. See the PR for #90 for the argument.
 *
 * **Unsaving removes the save and nothing else.** The trash control calls
 * `saved.unsave`, whose repository deletes one row; taken history and reviews
 * have no foreign key to it. Nothing on this screen may imply otherwise — no
 * "this will also remove…" confirmation, and no optimistic write that reaches
 * into `taken.list` or the review cache. `saved.spec.tsx` holds that.
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

  function unsave(courseCode: string) {
    setSaved(courseCode, false).catch(() =>
      toast.error(`Could not remove ${courseCode} from your saved courses.`),
    );
  }

  return (
    <PageColumn>
      <PageHeader
        title="Saved courses"
        subtitle="Keep track of courses you are interested in and organize them into collections."
      />

      <div className="flex flex-col gap-3.5 px-7 pt-[18px] pb-5">
        {isLoading ? (
          SKELETON_KEYS.map((key) => <CardSkeleton key={key} />)
        ) : courses.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {courses.map((course) => (
              <li key={course.courseCode}>
                <CourseCardItem
                  course={course}
                  stats={stats?.[course.courseCode] ?? NO_COURSE_STATS}
                  geo={EXPANDED_CARD_GEOMETRY}
                  action="add"
                  // Every card on this page is one the reader already saved, so
                  // the split Save button has nothing left to offer and the
                  // picker stands alone; removal is the trash control instead.
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
                  // saved list is a single column with nothing beside it, so a
                  // panel dropping from the last card would fall off the page.
                  pickerAbove
                  onRequestAuth={setAuthReason}
                />
              </li>
            ))}
          </ul>
        ) : (
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
