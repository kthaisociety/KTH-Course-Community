"use client";

import { CourseCard } from "@/features/courses/components/course-card";
import {
  type UseCourseCardOptions,
  useCourseCard,
} from "@/features/courses/hooks/use-course-card";
import type { CardGeometry } from "@/types";

type Props = UseCourseCardOptions & {
  /**
   * The screen's, because the collapse ramp belongs to whatever owns the
   * column's width: Explore interpolates it, Saved and Collections pin an end.
   */
  geo: CardGeometry;
  /** Opens the picker upwards, for a card near the bottom of a page. */
  pickerAbove?: boolean;
  /** Copy for the row that starts a new collection. */
  newLabel?: string;
};

/**
 * One course card in a list, bound to the viewer's own data.
 *
 * This is what Explore, Saved and Collections render. It exists to *be* the
 * component boundary `useCourseCard` needs: the hook holds several hooks of its
 * own, so calling it inside a screen's `courses.map(...)` would bind a card's
 * picker and draft to a list *position* — reorder the list and the open picker
 * jumps to another course; shorten it and React throws "Rendered fewer hooks
 * than expected". Rendered here, keyed by course code, that cannot happen: each
 * card's state lives in its own component instance.
 *
 * A screen therefore writes the loop and nothing else:
 *
 * ```tsx
 * {courses.map((course) => (
 *   <CourseCardItem
 *     key={course.courseCode}
 *     course={course}
 *     stats={stats[course.courseCode] ?? NO_STATS}
 *     geo={geo}
 *     onOpen={() => open(course.courseCode)}
 *     onRequestAuth={setAuthReason}
 *   />
 * ))}
 * ```
 */
export function CourseCardItem({
  geo,
  pickerAbove,
  newLabel,
  ...options
}: Props) {
  const card = useCourseCard(options);

  return (
    <CourseCard
      {...card}
      geo={geo}
      pickerAbove={pickerAbove}
      newLabel={newLabel}
    />
  );
}
