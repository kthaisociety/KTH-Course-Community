import { TRPCError } from "@trpc/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Post } from "@/features/reviews/components/post";
import { Review } from "@/features/reviews/components/review";
import { formatHp, formatTerm, kthCourseUrl } from "@/lib/kth";
import { sanitizeCourseHtml } from "@/lib/sanitize-html";
import { caller } from "@/trpc/server";
import type { ExamRoundSummary } from "@/types";

export type CourseProps = {
  courseCode: string;
  fromSaved?: boolean;
  openReviewOnLoad?: boolean;
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

export async function Course({
  courseCode,
  fromSaved = false,
  openReviewOnLoad = false,
}: CourseProps) {
  const backHref = fromSaved ? "/favorites" : "/search";
  const backLabel = fromSaved ? "Back to saved courses" : "Back to explore";

  const [details, reviews] = await Promise.all([
    caller.course.details({ courseCode }),
    caller.reviews.list({ courseCode }),
  ]).catch((error: unknown) => {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  });

  const kthUrl = kthCourseUrl(details.courseCode);
  const hp = formatHp(details.credits);

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
              {details.titleEng}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {hp} hp · {details.courseCode}
              {details.department ? ` · ${details.department}` : ""}
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
              /** biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with DOMPurify */
              dangerouslySetInnerHTML={{
                __html: sanitizeCourseHtml(details.goals),
              }}
            />
          </div>
          <div className="h-px bg-border" />
          <div>
            <SectionTitle id="course-content">Course content</SectionTitle>
            <div
              className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert"
              /** biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with DOMPurify */
              dangerouslySetInnerHTML={{
                __html: sanitizeCourseHtml(details.content),
              }}
            />
          </div>
        </div>
      </section>

      {details.rounds.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle>Course offerings</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {details.rounds.map((r, idx) => (
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

      {details.examinations.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle>Examinations</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {details.examinations.map((e: ExamRoundSummary) => (
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
          className="mb-4 text-lg font-semibold capitalize leading-tight"
        >
          Student reviews
        </h2>
        <p className="mb-4 text-muted-foreground text-sm">
          Here are review insights and student comments about the course.
        </p>
        <Review courseCode={details.courseCode} openOnLoad={openReviewOnLoad} />
        <div className="flex flex-col gap-4">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <Post
                key={review.id}
                className="w-full max-w-full border border-border bg-card shadow-sm"
                courseCode={details.courseCode}
                wouldRecommend={review.wouldRecommend}
                content={review.content}
                examinationMethods={review.examinationMethods}
                theoreticalVsApplied={review.theoreticalVsApplied}
                workload={review.workload}
                learningExperience={review.learningExperience}
                likeCount={review.likeCount}
                userVote={review.userVote}
                postId={review.id}
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
