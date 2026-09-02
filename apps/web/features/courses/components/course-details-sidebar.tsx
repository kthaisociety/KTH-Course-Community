"use client";

import { ExternalLink, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
    <h3 className="border-b border-border pb-1.5 text-base font-semibold uppercase tracking-wide text-foreground">
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
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Course details
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">
            {headerCode}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close course details"
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="scrollbar-subtle flex-1 overflow-y-auto px-5 py-4">
        {showError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Could not load course. {error}
          </div>
        ) : showSkeleton ? (
          <SidebarSkeleton />
        ) : details ? (
          <SidebarContent details={details} />
        ) : null}
      </div>
    </div>
  );
}

function SidebarContent({ details }: { details: CourseDetails }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold capitalize leading-tight text-foreground">
          {details.titleEng}
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          {formatHp(details.credits)} hp · {details.courseCode}
          {details.department ? ` · ${details.department}` : ""}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-8 gap-2 text-xs"
          asChild
        >
          <a
            href={kthCourseUrl(details.courseCode)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            Open on KTH.se
          </a>
        </Button>
      </div>

      {details.rounds.length > 0 && (
        <div>
          <SectionTitle>Offerings</SectionTitle>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
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
        <div>
          <SectionTitle>Examinations</SectionTitle>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
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

      <div>
        <SectionTitle>Content</SectionTitle>
        <div
          className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert"
          /** biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with DOMPurify */
          dangerouslySetInnerHTML={{
            __html: sanitizeCourseHtml(details.content),
          }}
        />
      </div>

      <div>
        <SectionTitle>Goals</SectionTitle>
        <div
          className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert"
          /** biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with DOMPurify */
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
      <div className="space-y-2">
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-2 h-8 w-32 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[92%]" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}
