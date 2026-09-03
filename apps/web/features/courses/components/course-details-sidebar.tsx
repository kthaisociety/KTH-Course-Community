"use client";

import { ExternalLink, X } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatHp, formatTerm, kthCourseUrl } from "@/lib/kth";
import { sanitizeCourseHtml } from "@/lib/sanitize-html";
import type { CourseDetails } from "@/types";

export type CourseDetailsSidebarProps = {
  /** The course code the sidebar was opened for — shown while details are loading. */
  courseCode: string;
  details: CourseDetails | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-base font-semibold uppercase tracking-wide text-foreground">
      {children}
    </h3>
  );
}

export function CourseDetailsSidebar({
  courseCode,
  details,
  loading,
  error,
  onClose,
}: CourseDetailsSidebarProps) {
  const headerCode = details?.courseCode ?? courseCode;
  const showSkeleton = !details && loading;
  const showError = !details && !loading && error;

  return (
    <Card className="h-full gap-0 p-0">
      <CardHeader className="p-5">
        <CardDescription>Course details</CardDescription>
        <CardTitle>{headerCode}</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close course details"
          >
            <X />
          </Button>
        </CardAction>
      </CardHeader>
      <Separator />
      <CardContent className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-5">
        {showError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load course</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : showSkeleton ? (
          <SidebarSkeleton />
        ) : details ? (
          <SidebarContent details={details} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function SidebarContent({ details }: { details: CourseDetails }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold capitalize leading-tight text-foreground">
          {details.titleEng}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatHp(details.credits)} hp · {details.courseCode}
          {details.department ? ` · ${details.department}` : ""}
        </p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <a
            href={kthCourseUrl(details.courseCode)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink data-icon="inline-start" />
            Open on KTH.se
          </a>
        </Button>
      </div>

      {details.rounds.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionTitle>Offerings</SectionTitle>
          <Separator />
          <ul className="flex flex-col gap-1.5 text-sm">
            {details.rounds.map((r, idx) => (
              <li
                key={`${r.startTerm}-${r.formattedPeriodsAndCredits ?? ""}-${idx}`}
                className="flex flex-wrap items-center gap-x-2 text-foreground"
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
        </div>
      )}

      {details.examinations.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionTitle>Examinations</SectionTitle>
          <Separator />
          <ul className="flex flex-col gap-1.5 text-sm">
            {details.examinations.map((e) => (
              <li
                key={e.examCode}
                className="flex flex-wrap items-center gap-x-2 text-foreground"
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
        </div>
      )}

      <div className="flex flex-col gap-3">
        <SectionTitle>Content</SectionTitle>
        <Separator />
        <div
          className="prose prose-sm mt-0 max-w-none text-foreground dark:prose-invert"
          /** biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized HTML */
          dangerouslySetInnerHTML={{
            __html: sanitizeCourseHtml(details.content),
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle>Goals</SectionTitle>
        <Separator />
        <div
          className="prose prose-sm mt-0 max-w-none text-foreground dark:prose-invert"
          /** biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized HTML */
          dangerouslySetInnerHTML={{
            __html: sanitizeCourseHtml(details.goals),
          }}
        />
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-2 h-8 w-32 rounded-md" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[92%]" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}
