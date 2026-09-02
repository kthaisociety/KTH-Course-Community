"use client";

import type { ExamRoundSummary } from "@shared/types";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth";
import {
  Post,
  type PostProps,
  Review,
  useAddReview,
  useReviewList,
} from "@/features/reviews";
import { kthCourseUrl as kthCoursePageUrl } from "@/lib/kth";
import { useCourseDetails } from "../api/queries";
import { CoursePageSkeleton } from "./course-page-skeleton";

function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </h2>
  );
}

function formatTerm(startTerm: number): string {
  const year = Math.floor(startTerm / 10);
  const half = startTerm % 10;
  const prefix = half === 1 ? "VT" : half === 2 ? "HT" : "";
  return prefix ? `${prefix}${String(year).slice(-2)}` : String(startTerm);
}

export function Course() {
  const params = useParams<{ courseCode: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useMe();
  const fromSaved = searchParams.get("from") === "saved";
  const openReviewOnLoad = searchParams.get("writeReview") === "1";
  const addReview = useAddReview();
  const backHref = fromSaved ? "/favorites" : "/search";
  const backLabel = fromSaved ? "Back to saved courses" : "Back to explore";

  const courseCode = params?.courseCode;
  const {
    data: courseDetails,
    isLoading: courseLoading,
    error: courseQueryError,
  } = useCourseDetails(courseCode);
  const {
    data: reviews,
    isLoading: reviewsLoading,
    isError: reviewsError,
  } = useReviewList(courseCode);
  const courseError = courseQueryError
    ? courseQueryError instanceof Error
      ? courseQueryError.message
      : "Failed to load course"
    : null;

  useEffect(() => {
    if (!params?.courseCode) router.push("/search");
  }, [params?.courseCode, router]);

  const posts: (PostProps & { postId: string })[] = Array.isArray(reviews)
    ? reviews.map((review) => ({ ...review, postId: review.id }))
    : [];

  const reviewsHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!openReviewOnLoad || !courseDetails) return;
    reviewsHeadingRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [openReviewOnLoad, courseDetails]);

  if (!params.courseCode) {
    return <CoursePageSkeleton backHref={backHref} backLabel={backLabel} />;
  }

  if (courseError && !courseLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-destructive text-lg font-medium">
          Could not load this course.
        </p>
        <p className="mt-2 text-muted-foreground text-sm">{courseError}</p>
        <button
          type="button"
          className="mt-6 text-primary text-sm underline"
          onClick={() => router.push(backHref)}
        >
          {backLabel}
        </button>
      </div>
    );
  }

  if (
    courseLoading ||
    !courseDetails ||
    (reviewsLoading && reviews == null && !reviewsError)
  ) {
    return (
      <CoursePageSkeleton
        courseCode={params.courseCode}
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }

  const kthUrl = kthCoursePageUrl(courseDetails.courseCode);
  const hp =
    courseDetails.credits != null && Number.isFinite(courseDetails.credits)
      ? Number.isInteger(courseDetails.credits)
        ? String(courseDetails.credits)
        : courseDetails.credits.toFixed(1)
      : "—";
  const reviewComposer = userId ? (
    <Review
      courseCode={courseDetails.courseCode}
      userId={userId}
      onAddReview={addReview}
      openOnLoad={openReviewOnLoad}
    />
  ) : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-16 pt-6">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {backLabel}
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold capitalize leading-tight text-foreground">
              {courseDetails.titleEng}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {hp} hp · {courseDetails.courseCode}
              {courseDetails.department ? ` · ${courseDetails.department}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 text-sm"
              asChild
            >
              <a href={kthUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                Open on KTH.se
              </a>
            </Button>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-6">
          <div>
            <SectionTitle id="course-goals">Goals</SectionTitle>
            <div
              className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert"
              /** biome-ignore lint/security/noDangerouslySetInnerHtml: course HTML from index */
              dangerouslySetInnerHTML={{
                __html: courseDetails.goals?.trim() || "<p>—</p>",
              }}
            />
          </div>
          <div className="h-px bg-border" />
          <div>
            <SectionTitle id="course-content">Course content</SectionTitle>
            <div
              className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert"
              /** biome-ignore lint/security/noDangerouslySetInnerHtml: course HTML from index */
              dangerouslySetInnerHTML={{
                __html: courseDetails.content?.trim() || "<p>—</p>",
              }}
            />
          </div>
        </div>
      </section>

      {courseDetails.rounds.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle>Course offerings</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {courseDetails.rounds.map((r, idx) => (
              <li
                key={`${r.startTerm}-${r.formattedPeriodsAndCredits ?? ""}-${idx}`}
                className="flex flex-wrap items-center gap-2 text-foreground"
              >
                <span className="font-medium">{formatTerm(r.startTerm)}</span>
                {r.formattedPeriodsAndCredits && (
                  <span className="text-muted-foreground">
                    · {r.formattedPeriodsAndCredits}
                  </span>
                )}
                {r.language && (
                  <span className="text-muted-foreground">· {r.language}</span>
                )}
                {r.tutoringForm && (
                  <span className="text-muted-foreground">
                    · {r.tutoringForm}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {courseDetails.examinations.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle>Examinations</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {courseDetails.examinations.map((e: ExamRoundSummary) => (
              <li
                key={e.examCode}
                className="flex flex-wrap items-center gap-2 text-foreground"
              >
                <span className="font-medium">{e.examCode}</span>
                {e.title && (
                  <span className="text-muted-foreground">· {e.title}</span>
                )}
                {e.credits != null && (
                  <span className="text-muted-foreground">
                    · {e.credits} hp
                  </span>
                )}
                {e.gradeScaleCode && (
                  <span className="text-muted-foreground">
                    · {e.gradeScaleCode}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="reviews-heading">
        <h2
          id="reviews-heading"
          ref={reviewsHeadingRef}
          className="mb-4 text-lg font-semibold capitalize leading-tight"
        >
          Student reviews
        </h2>
        <p className="mb-4 text-muted-foreground text-sm">
          Here are review insights and student comments about the course.
        </p>
        {reviewComposer ? <div className="mb-4">{reviewComposer}</div> : null}
        <div className="flex flex-col gap-4">
          {posts.length > 0 ? (
            posts.map((post) => (
              <Post
                key={post.postId}
                className="w-full max-w-full border border-border bg-card shadow-sm"
                courseCode={courseDetails.courseCode}
                wouldRecommend={post.wouldRecommend}
                content={post.content}
                examinationMethods={post.examinationMethods}
                theoreticalVsApplied={post.theoreticalVsApplied}
                workload={post.workload}
                learningExperience={post.learningExperience}
                likeCount={post.likeCount}
                dislikeCount={post.dislikeCount}
                userVote={post.userVote}
                postId={post.postId}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-muted-foreground text-sm">
              No reviews yet. Be the first to add a review for this course.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
