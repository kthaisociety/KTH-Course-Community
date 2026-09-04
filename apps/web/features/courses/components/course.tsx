import { TRPCError } from "@trpc/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Review, ReviewList } from "@/features/reviews";
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-6 pb-16">
      <Button variant="ghost" className="w-fit" asChild>
        <Link href={backHref}>
          <ArrowLeft data-icon="inline-start" />
          {backLabel}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{details.titleEng}</CardTitle>
          <CardDescription>
            {hp} hp · {details.courseCode}
            {details.department ? ` · ${details.department}` : ""}
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <a href={kthUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink data-icon="inline-start" />
                Open on KTH.se
              </a>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-6">
          <div>
            <SectionTitle id="course-goals">Goals</SectionTitle>
            <div
              className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert"
              /** biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized HTML */
              dangerouslySetInnerHTML={{
                __html: sanitizeCourseHtml(details.goals),
              }}
            />
          </div>
          <Separator />
          <div>
            <SectionTitle id="course-content">Course content</SectionTitle>
            <div
              className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert"
              /** biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized HTML */
              dangerouslySetInnerHTML={{
                __html: sanitizeCourseHtml(details.content),
              }}
            />
          </div>
        </CardContent>
      </Card>

      {details.rounds.length > 0 && (
        <Card>
          <CardHeader>
            <SectionTitle>Course offerings</SectionTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
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
                    <span className="text-muted-foreground">
                      · {r.language}
                    </span>
                  )}
                  {r.tutoringForm && (
                    <span className="text-muted-foreground">
                      · {r.tutoringForm}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {details.examinations.length > 0 && (
        <Card>
          <CardHeader>
            <SectionTitle>Examinations</SectionTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
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
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="reviews-heading">
        <h2
          id="reviews-heading"
          className="mb-4 text-lg font-semibold capitalize leading-tight"
        >
          Student reviews
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Here are review insights and student comments about the course.
        </p>
        <Review courseCode={details.courseCode} openOnLoad={openReviewOnLoad} />
        <ReviewList courseCode={details.courseCode} reviews={reviews} />
      </section>
    </div>
  );
}
