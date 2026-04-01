"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import CourseHeader, {
  type CourseHeaderProps,
} from "@/components/CourseHeader";
import Post, { type PostProps } from "@/components/Post";
import { Button } from "@/components/ui/button";
import type { NeonCoursePayload } from "@/lib/courses";
import { kthCourseUrl as kthCoursePageUrl } from "@/lib/kth";

export type CourseViewProps = CourseHeaderProps & {
  posts: (PostProps & { postId: string })[];
  onLikePost: (postId: string) => void;
  onDislikePost: (postId: string) => void;
  department: string;
  goalsHtml: string;
  contentHtml: string;
  summary?: string;
  neon: NeonCoursePayload | null;
  /** Precomputed; defaults to `kthCourseUrl(courseCode)` if omitted */
  kthCourseUrl?: string;
  /** Top nav link; default explore */
  backHref?: string;
  backLabel?: string;
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

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

export default function CourseView(props: CourseViewProps) {
  const backHref = props.backHref ?? "/search";
  const backLabel = props.backLabel ?? "Back to explore";
  const kthUrl = props.kthCourseUrl ?? kthCoursePageUrl(props.courseCode);
  const hp =
    props.credits != null && Number.isFinite(props.credits)
      ? Number.isInteger(props.credits)
        ? String(props.credits)
        : props.credits.toFixed(1)
      : "—";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-16 pt-6">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {backLabel}
      </Link>

      {/* Hero — matches search course card shell */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold capitalize leading-tight text-foreground">
              {props.courseName}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {hp} hp · {props.courseCode}
              {props.department ? ` · ${props.department}` : ""}
            </p>
            {props.summary?.trim() ? (
              <p className="mt-3 text-muted-foreground text-sm leading-snug">
                {props.summary.trim()}
              </p>
            ) : null}
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

      {/* Neon: authoritative course record */}
      <section className="rounded-lg border border-border bg-muted/30 p-5 shadow-sm">
        <SectionTitle>Course record (database)</SectionTitle>
        {props.neon ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Status</dt>
              <dd className="mt-0.5 font-medium text-sm capitalize">
                {props.neon.currentStatus.toLowerCase().replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">
                Record last updated
              </dt>
              <dd className="mt-0.5 font-medium text-sm">
                {formatDate(props.neon.updatedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Name (database)</dt>
              <dd className="mt-0.5 font-medium text-sm">{props.neon.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Course code</dt>
              <dd className="mt-0.5 font-medium text-sm">
                {props.neon.courseCode}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Department</dt>
              <dd className="mt-0.5 font-medium text-sm">
                {props.neon.department}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-muted-foreground text-sm">
            No matching database row was returned for this course code. Credits
            and catalog text may still be shown from the search index.
          </p>
        )}
      </section>

      {/* Goals & content from Elasticsearch */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-6">
          <div>
            <SectionTitle id="course-goals">Goals</SectionTitle>
            <div
              className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert"
              /** biome-ignore lint/security/noDangerouslySetInnerHtml: course HTML from index */
              dangerouslySetInnerHTML={{
                __html: props.goalsHtml?.trim() || "<p>—</p>",
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
                __html: props.contentHtml?.trim() || "<p>—</p>",
              }}
            />
          </div>
        </div>
      </section>

      {/* Review analytics + write review */}
      <section aria-labelledby="review-insights-heading">
        <h2
          id="review-insights-heading"
          className="mb-3 text-lg font-semibold capitalize leading-tight"
        >
          Review insights
        </h2>
        <CourseHeader
          courseCode={props.courseCode}
          courseName={props.courseName}
          courseRating={props.courseRating}
          easyScoreDistribution={props.easyScoreDistribution}
          usefulScoreDistribution={props.usefulScoreDistribution}
          interestingScoreDistribution={props.interestingScoreDistribution}
          ratingDistribution={props.ratingDistribution}
          credits={props.credits}
          syllabus={props.syllabus}
          percentageWouldRecommend={props.percentageWouldRecommend}
          onAddReview={props.onAddReview}
          userId={props.userId}
          openReview={props.openReview}
          className="border border-border bg-muted/20 md:gap-x-12"
        />
      </section>

      {/* Reviews */}
      <section aria-labelledby="reviews-heading">
        <h2
          id="reviews-heading"
          className="mb-4 text-lg font-semibold capitalize leading-tight"
        >
          Student reviews
        </h2>
        <p className="mb-4 text-muted-foreground text-sm">
          Scores are from 1 (low) to 5 (high). Text may include formatting from
          the editor.
        </p>
        <div className="flex flex-col gap-4">
          {props.posts && props.posts.length > 0 ? (
            props.posts.map((post) => (
              <Post
                key={post.postId}
                className="w-full max-w-full border border-border bg-card shadow-sm"
                wouldRecommend={post.wouldRecommend}
                content={post.content}
                easyScore={post.easyScore}
                usefulScore={post.usefulScore}
                interestingScore={post.interestingScore}
                likeCount={post.likeCount}
                dislikeCount={post.dislikeCount}
                userVote={post.userVote}
                postId={post.postId}
                onPostLike={props.onLikePost}
                onPostDislike={props.onDislikePost}
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
