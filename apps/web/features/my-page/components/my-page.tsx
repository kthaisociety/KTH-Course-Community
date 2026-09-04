"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Lock, RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMe, useRequireSession } from "@/features/auth";
import {
  type EditableReview,
  Review,
  ReviewCard,
  toEditableReview,
  UnreviewedCard,
  useRemoveReview,
  useUnreviewedTakenCourses,
} from "@/features/reviews";
import { PageColumn, PageHeader } from "@/features/shell";
import type { Me } from "@/lib/user";
import { uploadProfilePicture } from "@/lib/user";
import { useTRPC } from "@/trpc/client";
import type { Review as ReviewModel } from "@/types";
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
import { MyDot } from "./my-dot";

const VIEWS = ["overview", "reviews", "dot", "settings"] as const;
type MyPageView = (typeof VIEWS)[number];

const TAB_LABELS: Record<MyPageView, string> = {
  overview: "Overview",
  reviews: "Reviews",
  dot: "My dot",
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

/** Which review the delete dialog is about: `reviews.delete` needs the id, the cache needs the course. */
type PendingDelete = { id: string; courseCode: string };
/** Which review the editor is open on. The dialog is per-course, so it carries one. */
type OpenEditor = { review: EditableReview; courseCode: string };

/**
 * My Page — the signed-in reader's own page, at `/profile`.
 *
 * From `docs/design/Course Community - My Page.dc.html`, with its four tabs
 * (Overview, Reviews, My dot, Settings) and the Mobile Preview's stacked
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
  const { showAverage, setShowAverage } = useAveragePreference();
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
        className="mt-5 flex gap-1 overflow-x-auto border-cc-rule border-b px-7 @max-[440px]:px-[14px]"
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
            {key === "reviews" ? (
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
                    note={
                      upvotesOnMine === 0
                        ? "no upvotes yet"
                        : `${upvotesOnMine} members found them helpful`
                    }
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

                {unreviewed.isUnavailable ? (
                  <output className="block rounded-xl border border-cc-rule bg-cc-surface px-[17px] py-4 text-[12.5px] text-cc-dim">
                    Which of your courses still need a review could not be
                    worked out just now. Reload to try again.
                  </output>
                ) : (
                  <UnreviewedCard
                    courses={unreviewed.courses.map((course) => ({
                      code: course.courseCode,
                    }))}
                    onStart={() => {
                      const first = unreviewed.courses[0];
                      if (first) {
                        router.push(
                          `/course/${first.courseCode}?writeReview=1&from=my-page`,
                        );
                      }
                    }}
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

            {view === "dot" ? (
              <MyDot
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
          onEditingClose={() => setEditing(null)}
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

/**
 * Who the reader is, and the one control that changes it.
 *
 * The artboard's profile line reads "At KTH since 2023 · reviews signed Elsa
 * Lindqvist". The second half is dropped: reviews carry no name. The first half
 * is the earliest `attendance_year` on the viewer's taken courses, and it is
 * left out entirely when they have none rather than rendered as an em dash
 * beside a date that was never recorded.
 *
 * The picture posts to `/api/user/profile-picture`, which is multipart and
 * therefore not a tRPC procedure. That route already exists and is the only one.
 */
function Identity({
  user,
  sinceYear,
}: {
  user: Me | null;
  sinceYear: number | null;
}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);

  const name = user?.name ?? "";
  const email = user?.email ?? "";
  const image = preview ?? user?.image ?? null;

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file twice fires a change event again.
    event.target.value = "";
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    const result = await uploadProfilePicture(file);
    setUploading(false);
    setPreview(null);
    URL.revokeObjectURL(localPreview);

    if (!result.success) {
      toast.error(result.error || "Image upload failed.");
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: trpc.user.me.queryKey(),
    });
  }

  return (
    <div className="flex items-center gap-3.5 px-7 pt-[18px] @max-[440px]:px-[14px]">
      <Avatar className="size-[52px] flex-none">
        {image ? <AvatarImage src={image} alt="" /> : null}
        <AvatarFallback className="bg-cc-pill font-semibold text-[16px] text-cc-brand">
          {initialsOf(name || email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-semibold text-[19px] leading-[1.25]">
          {name || email}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-cc-muted">
          {sinceYear === null ? null : <span>At KTH since {sinceYear}</span>}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={isUploading}
            className="cursor-pointer font-medium text-cc-brand hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? "Uploading…" : "Change photo"}
          </button>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Upload a profile picture"
        onChange={(event) => void handleFile(event)}
      />
    </div>
  );
}

type ReviewColumnProps = {
  heading: string;
  reviews: ReviewModel[];
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: { label: string; onClick: () => void };
  onEdit?: (review: ReviewModel) => void;
  onDelete?: (review: ReviewModel) => void;
};

/**
 * One of the Reviews tab's two columns.
 *
 * No vote controls: voting happens where the review lives, on the course page,
 * and `reviews.vote` invalidates that course's list rather than this page's
 * unfiltered one. The cards still show the net score, which is what the artboard
 * puts in the column too.
 */
function ReviewColumn({
  heading,
  reviews,
  emptyTitle,
  emptyBody,
  emptyAction,
  onEdit,
  onDelete,
}: ReviewColumnProps) {
  return (
    <section>
      <h2 className="m-0 mb-2.5 font-semibold text-[12px] text-cc-dim uppercase tracking-[0.05em]">
        {heading}
      </h2>
      {reviews.length === 0 ? (
        <div className="rounded-xl border border-cc-rule3 border-dashed bg-cc-surface px-5 py-11 text-center">
          <div className="font-semibold text-[16px]">{emptyTitle}</div>
          <p className="mx-auto mt-[7px] max-w-[420px] text-[13px] text-cc-muted leading-[1.5]">
            {emptyBody}
          </p>
          {emptyAction ? (
            <button
              type="button"
              onClick={emptyAction.onClick}
              className="mt-4 inline-flex h-10 cursor-pointer items-center rounded-[9px] bg-cc-btn px-[17px] font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[.88]"
            >
              {emptyAction.label}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard
                review={review}
                isAuthor={Boolean(onEdit || onDelete)}
                onEdit={onEdit ? () => onEdit(review) : undefined}
                onDelete={onDelete ? () => onDelete(review) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Deleting one of the viewer's own reviews.
 *
 * Mounted only while a review is pending, because `useRemoveReview` is keyed by
 * course code and this page's reviews span many courses. It invalidates the
 * unfiltered list as well, which the hook cannot know about.
 */
function DeleteReviewDialog({
  pending,
  onClose,
}: {
  pending: PendingDelete;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const removeReview = useRemoveReview(pending.courseCode);

  const confirm = useCallback(async () => {
    onClose();
    const removed = await removeReview(pending.id);
    if (removed) {
      await queryClient.invalidateQueries({
        queryKey: trpc.reviews.list.queryKey(),
      });
    }
  }, [onClose, pending.id, queryClient, removeReview, trpc.reviews.list]);

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this review?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes your review of {pending.courseCode} — the scores, the
            examination split and the write-up — from the course, along with the
            votes it collected. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep review</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => void confirm()}
          >
            Delete review
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StatCard({
  label,
  value,
  unit,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-[17px] py-4 ${
        emphasis
          ? "border-cc-hov bg-cc-info-solid"
          : "border-cc-rule bg-cc-surface"
      }`}
    >
      <div className="font-medium text-[11.5px] text-cc-dim">{label}</div>
      <div
        className={`mt-[7px] font-semibold text-[28px] tracking-[-0.02em] tabular-nums ${
          emphasis ? "text-cc-brand" : ""
        }`}
      >
        {value}
        {unit ? (
          <span className="ml-1 font-medium text-[15px] text-cc-dim">
            {unit}
          </span>
        ) : null}
      </div>
      <div className="mt-[5px] text-[12px] text-cc-dim2">{note}</div>
    </div>
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

function initialsOf(value: string): string {
  const letters = value
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return letters.slice(0, 2) || "?";
}
