import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder while search results load — mirrors the legacy card layout
 * (left column + statistics rail), using the same pulsing {@link Skeleton}
 * primitive. Explore now owns its design-specific skeleton.
 */
export function CourseItemSkeleton() {
  return (
    <Card className="h-[280px] min-h-[280px] flex-row gap-0 p-0" aria-hidden>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <CardHeader className="p-0">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-full max-w-lg" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <Skeleton className="size-9 shrink-0 rounded-md" />
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-0">
          <div className="flex shrink-0 gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
            <Separator orientation="vertical" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <Skeleton className="mt-auto h-8 w-36 rounded-md" />
        </CardContent>
      </div>

      <Separator orientation="vertical" />

      <div className="flex h-full min-h-0 w-[232px] shrink-0 flex-col justify-between bg-muted/30 px-5 py-5">
        <div className="flex min-w-0 flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-1">
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
    </Card>
  );
}
