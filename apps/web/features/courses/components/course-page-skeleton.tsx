import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
 * shaped like {@link Course} (not search result cards).
 */
export function CoursePageSkeleton({
  courseCode,
  backHref = "/search",
  backLabel = "Back to explore",
}: CoursePageSkeletonProps) {
  const label = courseCode ? `Loading course ${courseCode}` : "Loading course";

  return (
    <section
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-6 pb-16"
      aria-busy="true"
      aria-label={label}
    >
      <Button variant="ghost" className="w-fit" asChild>
        <Link href={backHref}>
          <ArrowLeft data-icon="inline-start" />
          {backLabel}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <Skeleton className="h-9 w-full max-w-xl" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <SectionLabel>Goals</SectionLabel>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[92%]" />
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <SectionLabel>Course content</SectionLabel>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[88%]" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>

      <section aria-hidden>
        <Skeleton className="mb-3 h-7 w-40" />
        <Card>
          <CardContent className="grid gap-4 md:grid-cols-2 md:gap-x-12">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 flex-col gap-2 flex">
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
            <div className="flex flex-col gap-3">
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-hidden>
        <Skeleton className="mb-4 h-7 w-48" />
        <Skeleton className="mb-4 h-4 w-full max-w-xl" />
        <div className="flex flex-col gap-4">
          {["r1", "r2"].map((key) => (
            <Card key={key}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[90%]" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </section>
  );
}
