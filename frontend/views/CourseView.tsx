"use client";

import type { CourseRoundSummary, ExamRoundSummary } from "@shared/types";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import Post, { type PostProps } from "@/components/Post";
import { Button } from "@/components/ui/button";
import { kthCourseUrl as kthCoursePageUrl } from "@/lib/kth";

export type CourseViewProps = {
  courseCode: string;
  courseTitle: string;
  credits: number | null;
  department: string;
  goalsHtml: string;
  contentHtml: string;
  rounds: CourseRoundSummary[];
  examinations: ExamRoundSummary[];
  posts: (PostProps & { postId: string })[];
  /** Precomputed; defaults to `kthCourseUrl(courseCode)` if omitted */
  kthCourseUrl?: string;
  /** Top nav link; default explore */
  backHref?: string;
  backLabel?: string;
};

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
  // KOPPS encodes terms as YYYYN where N=1 (spring) or 2 (autumn).
  const year = Math.floor(startTerm / 10);
  const half = startTerm % 10;
  const prefix = half === 1 ? "VT" : half === 2 ? "HT" : "";
  return prefix ? `${prefix}${String(year).slice(-2)}` : String(startTerm);
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

      {/* Hero */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold capitalize leading-tight text-foreground">
              {props.courseTitle}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {hp} hp · {props.courseCode}
              {props.department ? ` · ${props.department}` : ""}
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

      {/* Goals & content */}
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

      {/* Rounds */}
      {props.rounds.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle>Course offerings</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {props.rounds.map((r, idx) => (
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

      {/* Examinations */}
      {props.examinations.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle>Examinations</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {props.examinations.map((e: ExamRoundSummary) => (
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

      {/* Reviews */}
      <section aria-labelledby="reviews-heading">
        <h2
          id="reviews-heading"
          className="mb-4 text-lg font-semibold capitalize leading-tight"
        >
          Student reviews
        </h2>
        <p className="mb-4 text-muted-foreground text-sm">
          Here are review insights and student comments about the course.
        </p>
        <div className="flex flex-col gap-4">
          {props.posts && props.posts.length > 0 ? (
            props.posts.map((post) => (
              <Post
                key={post.postId}
                className="w-full max-w-full border border-border bg-card shadow-sm"
                courseCode={props.courseCode}
                wouldRecommend={post.wouldRecommend}
                content={post.content}
                easyScore={post.easyScore}
                usefulScore={post.usefulScore}
                interestingScore={post.interestingScore}
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
