"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One row of the prompt: a course the viewer took and has not reviewed.
 *
 * `name` is optional because `user_taken_courses` stores only a course code —
 * the title lives on `courses` and is the screen's to look up. The artboard
 * falls back to the code when it has no name and so does this.
 */
export type UnreviewedCourse = {
  code: string;
  name?: string | null;
};

type Props = {
  /**
   * The unreviewed courses, already differenced against the viewer's reviews.
   * The card renders what it is given; `selectUnreviewedCourses` is what works
   * the set out.
   */
  courses: UnreviewedCourse[];
  /** Replaces the generated headline. Taken courses passes its own wording. */
  line?: string;
  /** How many rows to list before collapsing the rest into "+N more". */
  max?: number;
  /**
   * Opens the run-them-back-to-back reviewer. Required, because the artboard
   * never draws this card without its call to action — a screen that cannot
   * offer one has no business rendering the prompt.
   */
  onStart: () => void;
  /**
   * Handles a row instead of the default link into the review flow. This is the
   * artboard's own per-course `c.onClick`, which Taken courses uses to open its
   * reviewer in place rather than navigating away; My Page passes one too.
   */
  onSelect?: (courseCode: string) => void;
};

/** Where a course's review gets written. Same entry point Saved and Explore use. */
function reviewFlowHref(courseCode: string): string {
  return `/course/${courseCode}?writeReview=1`;
}

const ROW_CLASS =
  "flex w-full items-baseline gap-[9px] text-left transition-opacity hover:opacity-80";

function headlineFor(count: number): string {
  return count === 1
    ? "1 course has no review yet"
    : `${count} courses have no review yet`;
}

function fastTrackLabelFor(count: number): string {
  return count === 1 ? "Fast track it" : `Fast track all ${count}`;
}

function CourseRowContent({ course }: { course: UnreviewedCourse }) {
  return (
    <>
      <span
        aria-hidden
        className="mt-[5px] size-1 flex-none rounded-full bg-cc-brand opacity-50"
      />
      <span className="flex-none font-medium font-mono text-[12px] text-cc-brand">
        {course.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-cc-ink2">
        {course.name || course.code}
      </span>
    </>
  );
}

/**
 * The prompt shown for courses the viewer marked taken but never reviewed —
 * `docs/design/Course Community - Unreviewed Card.dc.html`.
 *
 * It is an invitation, not a warning, which is why it wears the ordinary card
 * surface and the brand button rather than the `--cc-warn-*` nudge palette; the
 * artboard makes the same choice.
 *
 * The card is deliberately incurious about the set. It takes a list and renders
 * it, so Taken courses (#92) and My Page (#93) can each hand it a differently
 * derived list — and so nothing here is tempted to show a satisfaction state
 * for a course that has no review to carry one.
 */
export function UnreviewedCard({
  courses,
  line,
  max = 6,
  onStart,
  onSelect,
}: Props) {
  // Nothing taken is unreviewed: there is nothing to invite. Guarded here so
  // neither screen has to remember to guard it.
  if (courses.length === 0) return null;

  const shown = courses.slice(0, max);
  const remaining = courses.length - shown.length;

  return (
    <div className="@container box-border w-full rounded-[12px] border border-cc-rule2 bg-cc-surface px-[18px] pt-4 pb-3.5 shadow-[0_1px_2px_rgba(20,30,45,.05)]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-[180px]">
          <p className="m-0 font-semibold text-[15.5px]">
            {line ?? headlineFor(courses.length)}
          </p>
          <p className="m-0 mt-[3px] text-[12.5px] text-cc-muted">
            Your review is what the next student reads.
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="flex h-10 flex-none items-center justify-center gap-2 rounded-[9px] bg-cc-btn px-[18px] font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[.88] @max-[440px]:w-full"
        >
          <MessageCircle size={15} aria-hidden />
          {fastTrackLabelFor(courses.length)}
        </button>
      </div>

      <ul className="mt-3 flex list-none flex-col gap-[7px] border-cc-rule border-t pt-3 pl-0">
        {shown.map((course) => (
          <li key={course.code} className="m-0">
            <CourseRow course={course} onSelect={onSelect} />
          </li>
        ))}
        {remaining > 0 ? (
          <li className="m-0 text-[12px] text-cc-dim2">+{remaining} more</li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * A row navigates into the review flow by default, so the card is useful with
 * nothing but a list. `onSelect` swaps the link for a button when the screen
 * would rather open a reviewer in place than leave the page.
 */
function CourseRow({
  course,
  onSelect,
}: {
  course: UnreviewedCourse;
  onSelect?: (courseCode: string) => void;
}): ReactNode {
  if (onSelect) {
    return (
      <button
        type="button"
        className={ROW_CLASS}
        onClick={() => onSelect(course.code)}
      >
        <CourseRowContent course={course} />
      </button>
    );
  }

  return (
    <Link href={reviewFlowHref(course.code)} className={ROW_CLASS}>
      <CourseRowContent course={course} />
    </Link>
  );
}
