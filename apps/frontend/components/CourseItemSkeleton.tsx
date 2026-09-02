import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder while search results load — mirrors {@link CourseCardWithCharts}
 * layout (left column + charts rail), using the same pulsing {@link Skeleton} primitive.
 */
export function CourseItemSkeleton() {
  return (
    <div
      className="flex h-[280px] min-h-[280px] overflow-hidden rounded-lg border border-border bg-card shadow-sm"
      aria-hidden
    >
      {/* Left — title, actions, keywords / prerequisites, summary, buttons */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-7 w-full max-w-lg" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          </div>
        </div>

        <div className="flex shrink-0 gap-4 px-0 py-1.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[85%]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 border-l border-border/60 pl-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>

        <div className="mt-auto flex shrink-0 flex-wrap gap-2 pt-2.5">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>
      </div>

      {/* Right — charts block, stats row, compare (matches CourseCardWithCharts rail) */}
      <div className="flex h-full min-h-0 w-[232px] shrink-0 flex-col justify-between border-l border-border bg-muted/30 px-5 py-5">
        <div className="flex min-w-0 flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-[70%]" />
              <Skeleton className="h-3.5 w-full rounded-sm" />
            </div>
          ))}
        </div>
        <div className="flex w-full shrink-0 items-center justify-center gap-x-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex shrink-0 justify-center">
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}
