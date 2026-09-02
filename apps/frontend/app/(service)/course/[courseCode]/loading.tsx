import { CoursePageSkeleton } from "@/features/courses";

/** Shown during navigations to /course/[courseCode] — empty page shell (no spinner). */
export default function CourseRouteLoading() {
  return <CoursePageSkeleton />;
}
