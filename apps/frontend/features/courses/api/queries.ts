"use client";

import { useTRPC } from "@/trpc/client";

export function useCourseQueries() {
  const trpc = useTRPC();

  return {
    details: (courseCode: string) =>
      trpc.course.details.queryOptions({ courseCode }),
    summary: (courseCode: string) =>
      trpc.course.summary.queryOptions({ courseCode }),
  };
}
