import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export type CoursePageSkeletonProps = {
  /** Shown in the hero line when the URL already includes the code (stable while loading). */
  courseCode?: string;
  backHref?: string;
  backLabel?: string;
};

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

/**
 * Course detail loading state: same pulsing {@link Skeleton} treatment as search placeholders,
 * shaped like {@link CourseView} (not search result cards).
 */
export function CoursePageSkeleton({
  courseCode,
  backHref = "/search",
  backLabel = "Back to explore",
}: CoursePageSkeletonProps) {
  const label = courseCode ? `Loading course ${courseCode}` : "Loading course";

  return (
    <section
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-16 pt-6"
      aria-busy="true"
      aria-label={label}
    >
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {backLabel}
      </Link>

      {/* Hero — matches CourseView hero */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-9 w-full max-w-xl" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <Skeleton className="h-9 w-44 shrink-0 rounded-md" />
        </div>
      </div>

      <section className="rounded-lg border border-border bg-muted/30 p-5 shadow-sm">
        <SectionLabel>Course record (database)</SectionLabel>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {["a", "b", "c", "d"].map((key) => (
            <div key={key}>
              <Skeleton className="mb-2 h-3 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-6">
          <div>
            <SectionLabel>Goals</SectionLabel>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
            </div>
          </div>
          <div className="h-px bg-border" />
          <div>
            <SectionLabel>Course content</SectionLabel>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[88%]" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </section>

      <section aria-hidden>
        <Skeleton className="mb-3 h-7 w-40" />
        <div className="rounded-lg border border-border bg-muted/20 p-4 shadow-sm md:p-6">
          <div className="grid gap-4 md:grid-cols-2 md:gap-x-12">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-56" />
                </div>
                <Skeleton className="h-24 w-36 shrink-0 rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-14 rounded-md" />
                <Skeleton className="h-14 rounded-md" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>
        </div>
      </section>

      <section aria-hidden>
        <Skeleton className="mb-4 h-7 w-48" />
        <Skeleton className="mb-4 h-4 w-full max-w-xl" />
        <div className="flex flex-col gap-4">
          {["r1", "r2"].map((key) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
              </div>
              <div className="mt-4 flex gap-4">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
