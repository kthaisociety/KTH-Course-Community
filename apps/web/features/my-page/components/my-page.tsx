"use client";

import { Lock, RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useMe, useRequireSession } from "@/features/auth";
import {
  type EditableReview,
  Review,
  toEditableReview,
  UnreviewedCard,
  useUnreviewedTakenCourses,
} from "@/features/reviews";
import { PageColumn, PageHeader } from "@/features/shell";
import {
  isTierUnavailable,
  useAllReviews,
  useEffectiveTier,
  useTakenCourses,
} from "../api/queries";
import { useAveragePreference } from "../hooks/use-average-preference";
import {
  creditWeightedAverage,
  totalEarnedCredits,
} from "../lib/grade-average";
import { AccountSettings } from "./account-settings";
import { DeleteReviewDialog, type PendingDelete } from "./delete-review-dialog";
import { Identity } from "./identity";
import { NodeProfile } from "./node-profile";
import { ReviewColumn } from "./review-column";
import { StatCard } from "./stat-card";

// "node" rather than the artboard's "dot": `CONTEXT.md` licenses "dot" for
// **Find your dot**'s copy alone, so the tab is labelled "My dot" and named for
// the **Node profile** it shows.
const VIEWS = ["overview", "reviews", "node", "settings"] as const;
type MyPageView = (typeof VIEWS)[number];

const TAB_LABELS: Record<MyPageView, string> = {
  overview: "Overview",
  reviews: "Reviews",
  node: "My dot",
  settings: "Settings",
};

const PANEL_ID = "my-page-panel";
const tabId = (view: MyPageView) => `my-page-tab-${view}`;

/** What each key does to the selected tab. */
const TAB_KEY_STEPS: Record<string, number | "first" | "last" | undefined> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  Home: "first",
  End: "last",
};

/** Which review the editor is open on. The dialog is per-course, so it carries one. */
type OpenEditor = { review: EditableReview; courseCode: string };

/**
 * My Page — the signed-in reader's own page, at `/profile`.
 *
 * From `docs/design_ref/2026-09-05/Course Community - My Page.dc.html`, with its four
 * tabs (Overview, Reviews, My dot, Settings) and the Mobile Preview's stacked
 * version of the same. Everything it shows is the viewer's own: `user.me` for
 * who they are, `taken.list` for their courses, `reviews.list` for what they
 * wrote and upvoted, `graph.effectiveTier` for how far their node is unlocked.
 *
 * ## Reviews here are anonymous, and votes are not local
 *
 * `cc-store.js` gives every review an `author` and a `signedName`, and keeps
 * the reader's likes in a `localStorage` array. Both are wrong against the
 * schema, and both surface on this page in the artboard: its profile line reads
 * "reviews signed Elsa Lindqvist" and its second review column is headed "Liked
 * reviews".
 *
 * So: the signature is gone from the profile line and from the Settings panel,
 * because `reviews` carries a user id and no surface in this app renders a
 * reviewer's name. And the second column is the reviews the viewer **upvoted**,
 * read off `userVote` — which `reviews.list` returns from `review_votes` for
 * whoever is asking. There is no local vote state on this page.
 *
 * ## What the tabs cost
 *
 * `useUnreviewedTakenCourses` fetches one `reviews.list` per taken course;
 * `useAllReviews` fetches the unfiltered list once. They overlap, and the
 * overlap is deliberate — #93 forbids a second unreviewed-courses derivation,
 * and the upvoted column cannot be built from per-course lists of courses the
 * viewer happens to have taken. `useAllReviews` says what the unfiltered read
 * costs and what would fix it.
 */
export function MyPage() {
  useRequireSession();
  const router = useRouter();
  const {
    user,
    isLoading: isSessionLoading,
    isAuthenticated,
    userId,
  } = useMe();

  const [view, setView] = useState<MyPageView>("overview");
  const [editing, setEditing] = useState<OpenEditor | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const { showAverage, setShowAverage } = useAveragePreference(userId);
  const tabRefs = useRef<Partial<Record<MyPageView, HTMLButtonElement | null>>>(
    {},
  );

  /** Left/right, Home and End move between tabs, as a tablist is expected to. */
  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = TAB_KEY_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();

    const at = VIEWS.indexOf(view);
    const next =
      step === "first"
        ? VIEWS[0]
        : step === "last"
          ? VIEWS[VIEWS.length - 1]
          : VIEWS[(at + step + VIEWS.length) % VIEWS.length];

    setView(next);
    tabRefs.current[next]?.focus();
  }

  const takenQuery = useTakenCourses(isAuthenticated);
  const reviewsQuery = useAllReviews(isAuthenticated);
  const tierQuery = useEffectiveTier(isAuthenticated);
  const unreviewed = useUnreviewedTakenCourses();

  const takenCourses = useMemo(() => takenQuery.data ?? [], [takenQuery.data]);
  const allReviews = useMemo(
    () => reviewsQuery.data ?? [],
    [reviewsQuery.data],
  );

  const myReviews = useMemo(
    () => allReviews.filter((review) => review.userId === userId),
    [allReviews, userId],
  );
  // Someone else's review that this viewer upvoted. Their own reviews are
  // excluded even if they voted on one: this column is for what they kept, and
  // it already sits beside the column of what they wrote.
  const upvotedReviews = useMemo(
    () =>
      allReviews.filter(
        (review) => review.userId !== userId && review.userVote === "up",
      ),
    [allReviews, userId],
  );

  const grades = creditWeightedAverage(takenCourses);
  const credits = totalEarnedCredits(takenCourses);
  const attendanceYears = takenCourses
    .map((course) => course.attendanceYear)
    .filter((year): year is number => year !== null)
    .sort((a, b) => a - b);
  const lastImportedAt = takenCourses
    .map((course) => course.transcriptImportedAt)
    .filter((at): at is string => at !== null)
    .sort()
    .at(-1);
  const upvotesOnMine = myReviews.reduce(
    (total, review) => total + review.upvoteCount,
    0,
  );

  const isLoading =
    isSessionLoading ||
    (isAuthenticated && (takenQuery.isPending || reviewsQuery.isPending));
  const isError = takenQuery.isError || reviewsQuery.isError;

  function refetchAll() {
    void takenQuery.refetch();
    void reviewsQuery.refetch();
  }

  // Signed out. `proxy.ts` only checks that a session cookie exists, so a stale
  // one lands here; the artboard's own sign-in panel is what it gets.
  if (!isSessionLoading && !isAuthenticated) {
    return (
      <PageColumn>
        <PageHeader title="My Page" subtitle="Private to you." />
        <SignedOutPanel />
      </PageColumn>
    );
  }

  return (
    <PageColumn>
      <PageHeader title="My Page" subtitle="Private to you." />

      <Identity user={user} sinceYear={attendanceYears[0] ?? null} />

      {/*
        A real tablist, not a nav of links: the four sections are one panel
        swapped in place and none of them has a URL of its own. That buys the
        arrow-key movement below, which is the half of the pattern most often
        left out.
      */}
      <div
        role="tablist"
        aria-label="My Page sections"
        className="scrollbar-subtle mt-5 flex gap-1 overflow-x-auto border-cc-rule border-b px-7 @max-[440px]:px-[14px]"
      >
        {VIEWS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={tabId(key)}
            aria-selected={view === key}
            aria-controls={PANEL_ID}
            tabIndex={view === key ? 0 : -1}
            ref={(node) => {
              tabRefs.current[key] = node;
            }}
            onKeyDown={onTabKeyDown}
            onClick={() => setView(key)}
            className={`flex h-10 flex-none cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-[13px] text-[13.5px] ${
              view === key
                ? "border-cc-brand font-semibold text-cc-ink"
                : "border-transparent font-medium text-cc-dim hover:text-cc-ink"
            }`}
          >
            {TAB_LABELS[key]}
            {/*
              The count is counted off `reviews.list`, so it may only be shown
              on the same terms as the panel it summarises. An empty list is
              what the query holds while it is still in flight and what it may
              still hold from an earlier read once it has failed, and either way
              a pill beside "Your page did not load" states a total the page has
              just said it does not have — a confident "0" over a reader whose
              reviews simply have not arrived, or a stale count of this
              account's activity outlasting the read that fetched it. No number
              is the honest answer until there is one.
            */}
            {key === "reviews" && !isLoading && !isError ? (
              <>
                <span
                  aria-hidden
                  className="rounded-full bg-cc-pill px-[7px] py-px font-semibold text-[11.5px] text-cc-brand tabular-nums"
                >
                  {myReviews.length + upvotedReviews.length}
                </span>
                {/* The pill runs straight on to the label without it. */}
                <span className="sr-only">
                  , {myReviews.length + upvotedReviews.length} in total
                </span>
              </>
            ) : null}
          </button>
        ))}
      </div>

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(view)}>
        {isLoading ? <MyPageSkeleton /> : null}
        {!isLoading && isError ? <LoadFailed onRetry={refetchAll} /> : null}

        {!isLoading && !isError ? (
          <>
            {view === "overview" ? (
              <div className="flex flex-col gap-4 px-7 pt-[22px] @max-[440px]:px-[14px] @max-[440px]:pt-3">
                <div className="grid grid-cols-4 gap-3 @max-[860px]:grid-cols-2">
                  <StatCard
                    label="Taken courses"
                    value={String(takenCourses.length)}
                    note={
                      lastImportedAt
                        ? `read from your transcript ${formatDate(lastImportedAt)}`
                        : "nothing imported from a transcript"
                    }
                  />
                  <StatCard
                    label="Credits earned"
                    value={credits.toFixed(1)}
                    unit="hp"
                    note={formatYearRange(attendanceYears)}
                  />
                  <StatCard
                    label="Written reviews"
                    value={String(myReviews.length)}
                    note={upvoteNote(upvotesOnMine)}
                  />
                  <StatCard
                    label="Average grade"
                    value={
                      grades.average !== null && showAverage
                        ? grades.average.toFixed(1)
                        : "—"
                    }
                    note={averageNote(
                      grades.hasStoredGrades,
                      grades.average,
                      showAverage,
                    )}
                    emphasis={grades.average !== null && showAverage}
                  />
                </div>

                {/*
                  Three states, not two. `UnreviewedCard` renders nothing for an
                  empty list, and an empty list is also what the hook reports
                  while it is still differencing taken courses against reviews —
                  so drawing the card's slot as blank mid-flight would tell a
                  reader with unreviewed courses that they had none. The
                  placeholder says the question is still open.
                */}
                {unreviewed.isLoading ? (
                  <div
                    aria-hidden
                    className="h-[140px] animate-pulse rounded-xl border border-cc-rule2 bg-cc-surface"
                  />
                ) : unreviewed.isUnavailable ? (
                  <output className="block rounded-xl border border-cc-rule bg-cc-surface px-[17px] py-4 text-[12.5px] text-cc-dim">
                    Which of your courses still need a review could not be
                    worked out just now. Reload to try again.
                  </output>
                ) : (
                  /*
                    Both the button and a row deep-link the fast-track
                    reviewer, which is where the artboard's own My Page sends
                    them (`window.location.href = "…Taken Courses…?review=1"`).
                    This page has no reviewer of its own and should not grow
                    one: `/taken` owns the queue, and it is the screen that
                    knows which courses are still unreviewed by the time the
                    reader gets there.
                  */
                  <UnreviewedCard
                    courses={unreviewed.courses.map((course) => ({
                      code: course.courseCode,
                    }))}
                    onStart={() => router.push("/taken?review=1")}
                    onSelect={() => router.push("/taken?review=1")}
                  />
                )}
              </div>
            ) : null}

            {view === "reviews" ? (
              <div className="grid grid-cols-[1fr_1px_1fr] gap-6 px-7 pt-[22px] @max-[860px]:grid-cols-1 @max-[440px]:px-[14px] @max-[440px]:pt-3">
                <ReviewColumn
                  heading="Your reviews"
                  reviews={myReviews}
                  emptyTitle="Nothing written yet"
                  emptyBody="Reviews you publish land here, with how many members found them helpful."
                  emptyAction={{
                    label: "Find a course to review",
                    onClick: () => router.push("/search"),
                  }}
                  onEdit={(review) =>
                    setEditing({
                      review: toEditableReview(review),
                      courseCode: review.courseCode,
                    })
                  }
                  onDelete={(review) =>
                    setPendingDelete({
                      id: review.id,
                      courseCode: review.courseCode,
                    })
                  }
                />

                <div aria-hidden className="bg-cc-rule @max-[860px]:hidden" />

                <ReviewColumn
                  heading="Reviews you upvoted"
                  reviews={upvotedReviews}
                  emptyTitle="No upvoted reviews"
                  emptyBody="Upvoting a review on a course page keeps it here, so you can find it again."
                />
              </div>
            ) : null}

            {view === "node" ? (
              <NodeProfile
                effectiveTier={tierQuery.data}
                isUnavailable={
                  tierQuery.isError && isTierUnavailable(tierQuery.error)
                }
              />
            ) : null}

            {view === "settings" ? (
              <AccountSettings
                takenCourses={takenCourses}
                hasStoredGrades={grades.hasStoredGrades}
                average={grades.average}
                showAverage={showAverage}
                onShowAverageChange={setShowAverage}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <p className="m-0 flex items-start gap-2 px-7 pt-[22px] text-[11.5px] text-cc-dim2 @max-[440px]:px-[14px]">
        <TriangleAlert aria-hidden className="mt-px size-[13px] flex-none" />
        Course Community is run by KTH AI Society, a student organisation.
        Credits, grades and any average shown here are your own entries — not an
        official KTH record.
      </p>

      {editing ? (
        <Review
          key={editing.review.id}
          courseCode={editing.courseCode}
          editing={editing.review}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteReviewDialog
          pending={pendingDelete}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </PageColumn>
  );
}

/** The artboard's signed-out panel, for a session that expired on the way here. */
function SignedOutPanel() {
  return (
    <div className="px-7 pt-[18px] @max-[440px]:px-[14px]">
      <div className="max-w-[520px] rounded-[11px] border border-cc-rule2 bg-cc-surface px-[17px] py-4">
        <div className="flex items-center gap-2">
          <Lock
            aria-hidden
            className="size-[15px] text-cc-dim"
            strokeWidth={1.8}
          />
          <div className="font-semibold text-[13.5px]">
            Sign in to see your page
          </div>
        </div>
        <p className="m-0 mt-1.5 text-[12.5px] text-cc-muted leading-[1.5]">
          Your course list, reviews and average stay private to you and sync
          across devices.
        </p>
        <Link
          href="/auth"
          className="mt-[11px] inline-flex h-8 items-center rounded-lg bg-cc-btn px-3.5 font-semibold text-[12.5px] text-cc-btn-fg no-underline hover:opacity-[.88]"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

const SKELETON_KEYS = ["k0", "k1", "k2", "k3"] as const;

function MyPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-4 px-7 pt-[22px] @max-[440px]:px-[14px]"
    >
      <div className="grid grid-cols-4 gap-3 @max-[860px]:grid-cols-2">
        {SKELETON_KEYS.map((key) => (
          <div
            key={key}
            className="rounded-xl border border-cc-rule bg-cc-surface px-[17px] py-4"
          >
            <div className="h-[11px] w-[70%] animate-pulse rounded bg-cc-pill" />
            <div className="mt-3 h-[22px] w-[46%] animate-pulse rounded-[5px] bg-cc-rule" />
          </div>
        ))}
      </div>
      <div className="h-[140px] animate-pulse rounded-xl border border-cc-rule bg-cc-surface" />
    </div>
  );
}

/** The artboard's "Could not load" panel. Nothing was written, so it says so. */
function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex justify-center px-7 pt-[22px] @max-[440px]:px-[14px]">
      <div className="w-full max-w-[560px] rounded-[14px] border border-cc-danger/40 bg-cc-surface px-6 pt-[26px] pb-[22px]">
        <div className="flex items-center gap-2.5 font-semibold text-[11px] text-cc-danger uppercase tracking-[0.09em]">
          <TriangleAlert
            aria-hidden
            className="size-[15px]"
            strokeWidth={2.2}
          />
          Could not load
        </div>
        <h2 className="m-0 mt-3 font-semibold text-[20px] leading-[1.25]">
          Your page did not load
        </h2>
        <p className="m-0 mt-2 text-[13.5px] text-cc-muted leading-[1.55] text-pretty">
          The request for your courses and reviews did not come back. Nothing is
          lost — this is a read, so nothing of yours was changed.
        </p>
        <div className="mt-[18px] flex items-center gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-[9px] bg-cc-btn px-[17px] font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[.88]"
          >
            <RotateCw aria-hidden className="size-[15px]" strokeWidth={1.9} />
            Try again
          </button>
          <Link
            href="/search"
            className="flex h-10 items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-[15px] font-medium text-[13px] text-cc-chip-ink no-underline hover:border-cc-hov"
          >
            Browse courses instead
          </Link>
        </div>
      </div>
    </div>
  );
}

/** #97 settled the substitution: members, never students — it is app users who vote. */
function upvoteNote(upvotes: number): string {
  if (upvotes === 0) return "no upvotes yet";
  return upvotes === 1
    ? "1 member found them helpful"
    : `${upvotes} members found them helpful`;
}

function averageNote(
  hasStoredGrades: boolean,
  average: number | null,
  showAverage: boolean,
): string {
  if (!hasStoredGrades) return "no grades stored";
  if (!showAverage) return "not calculated";
  if (average === null) return "no A-E grades to average";
  return "credit-weighted, A-E only · yours alone";
}

function formatYearRange(years: number[]): string {
  if (years.length === 0) return "—";
  const first = years[0];
  const last = years[years.length - 1];
  return first === last ? String(first) : `${first} – ${last}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}
