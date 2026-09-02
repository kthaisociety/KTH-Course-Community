"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useCourseDetails(courseCode: string | null | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.course.details.queryOptions({ courseCode: courseCode ?? "" }),
    enabled: Boolean(courseCode),
  });
}
