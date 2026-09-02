"use client";

import { useQuery } from "@tanstack/react-query";
import { getCourseDetails } from "@/lib/courses";
import { queryKeys } from "@/lib/query-keys";

export function useCourseDetails(courseCode: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.courseDetails(courseCode ?? ""),
    queryFn: () => getCourseDetails(courseCode as string),
    enabled: Boolean(courseCode),
  });
}
