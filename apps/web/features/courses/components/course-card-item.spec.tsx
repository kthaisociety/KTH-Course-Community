import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXPANDED_CARD_GEOMETRY } from "../lib/card-geometry";
import type { CourseCardCourse } from "../lib/course-card-model";
import { CourseCardItem } from "./course-card-item";

const useMe = vi.fn();

vi.mock("@/features/auth", () => ({ useMe: () => useMe() }));
vi.mock("@/features/favorites", () => ({
  useSetCourseSaved: () => ({ setSaved: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/features/courses/api/queries", () => ({
  useCollections: () => ({ data: [] }),
  useTakenCourses: () => ({ data: [] }),
}));
vi.mock("@/features/courses/api/mutations", () => ({
  useCollectionMutations: () => ({
    create: { mutateAsync: vi.fn() },
    addCourse: { mutateAsync: vi.fn() },
    removeCourse: { mutateAsync: vi.fn() },
  }),
  useMarkCourseTaken: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const ALPHA: CourseCardCourse = {
  courseCode: "AA1000",
  titleEng: "Alpha",
  credits: 6,
  department: "EECS",
};
const BETA: CourseCardCourse = {
  courseCode: "BB2000",
  titleEng: "Beta",
  credits: 6,
  department: "EECS",
};

function List({ courses }: { courses: CourseCardCourse[] }) {
  return (
    <>
      {courses.map((course) => (
        <CourseCardItem
          key={course.courseCode}
          course={course}
          stats={{ reviews: null, takenCount: 0 }}
          geo={EXPANDED_CARD_GEOMETRY}
          onRequestAuth={vi.fn()}
        />
      ))}
    </>
  );
}

/** The picker is open on exactly the card whose "Create new collection" shows. */
function cardWithOpenPicker(): number {
  return screen.getAllByRole("article").findIndex(
    (card) =>
      within(card).queryByRole("button", {
        name: "Create new collection",
      }) !== null,
  );
}

beforeEach(() => {
  useMe.mockReturnValue({ user: { userId: "u1", savedCourseCodes: [] } });
});

describe("CourseCardItem", () => {
  it("renders one bound card per course", () => {
    render(<List courses={[ALPHA, BETA]} />);
    expect(
      screen.getByRole("heading", { name: "AA1000 Alpha" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "BB2000 Beta" }),
    ).toBeInTheDocument();
  });

  // The reason this component exists. Called from a screen's own map callback,
  // `useCourseCard`'s hooks would bind to a list position: reordering would move
  // the open picker to another course, and shortening the list would throw
  // "Rendered fewer hooks than expected". Keyed instances cannot do either.
  describe("a list that changes under the reader", () => {
    it("keeps an open picker on the course it was opened for", async () => {
      const { rerender } = render(<List courses={[ALPHA, BETA]} />);

      await userEvent.click(
        within(screen.getAllByRole("article")[0] as HTMLElement).getByRole(
          "button",
          { name: "Add to collections" },
        ),
      );
      expect(cardWithOpenPicker()).toBe(0);

      rerender(<List courses={[BETA, ALPHA]} />);

      const reordered = screen.getAllByRole("article");
      expect(
        within(reordered[0] as HTMLElement).getByText("BB2000 Beta"),
      ).toBeVisible();
      // Alpha moved to the end, and the picker went with it.
      expect(cardWithOpenPicker()).toBe(1);
    });

    it("survives the list getting shorter", () => {
      const { rerender } = render(<List courses={[ALPHA, BETA]} />);
      expect(() => rerender(<List courses={[ALPHA]} />)).not.toThrow();
      expect(screen.getAllByRole("article")).toHaveLength(1);
    });
  });
});
