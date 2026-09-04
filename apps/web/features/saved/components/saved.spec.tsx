import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Saved } from "./saved";

const push = vi.fn();
const useMe = vi.fn();
const setSaved = vi.fn();
const takenCourses = vi.fn();
const markTaken = vi.fn();
const addCourse = vi.fn();
const removeCourse = vi.fn();
const summariesPending = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/auth", () => ({
  useMe: () => useMe(),
  useRequireSession: () => ({}),
  AuthReasonDialog: () => null,
}));
vi.mock("@/features/courses/api/queries", () => ({
  useCourseDetails: () => ({ data: undefined }),
  useCourseSummaries: (codes: string[]) =>
    codes.map((courseCode) => ({
      data: summariesPending() ? undefined : CATALOGUE[courseCode],
      isPending: summariesPending(),
    })),
  useCourseStats: () => ({ data: {}, isPending: false }),
  useCollections: () => ({ data: [] }),
  useTakenCourses: () => ({ data: takenCourses() }),
}));
vi.mock("@/features/courses/api/mutations", () => ({
  useCollectionMutations: () => ({
    create: { mutateAsync: vi.fn() },
    addCourse: { mutateAsync: addCourse },
    removeCourse: { mutateAsync: removeCourse },
  }),
  useMarkCourseTaken: () => ({ mutateAsync: markTaken }),
}));
vi.mock("../api/mutations", () => ({
  useSetCourseSaved: () => ({ setSaved }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const CATALOGUE: Record<
  string,
  {
    courseCode: string;
    titleEng: string;
    credits: number;
    department: string;
  }
> = {
  DD2380: {
    courseCode: "DD2380",
    titleEng: "Artificial Intelligence",
    credits: 6,
    department: "EECS",
  },
  DD2421: {
    courseCode: "DD2421",
    titleEng: "Machine Learning",
    credits: 7.5,
    department: "EECS",
  },
};

function saved(...courseCodes: string[]) {
  useMe.mockReturnValue({
    user: { userId: "u1", savedCourseCodes: courseCodes },
    isLoading: false,
  });
}

function cardFor(courseCode: string): HTMLElement {
  const card = screen
    .getAllByRole("article")
    .find((article) => within(article).queryByText(new RegExp(courseCode)));
  if (!card) throw new Error(`No card rendered for ${courseCode}`);
  return card;
}

beforeEach(() => {
  saved();
  takenCourses.mockReturnValue([]);
  summariesPending.mockReturnValue(false);
  setSaved.mockResolvedValue(undefined);
});

/**
 * The whole suite runs in about a second and a half warm. Cold — a fresh Vite
 * cache, or a machine running several of these at once — the *first* render of
 * a real `CourseCard` into jsdom has overrun the 5s default on its own while
 * every test after it stayed under a second. The budget is here so a loaded
 * machine reports itself as slow rather than as a broken page.
 */
describe("Saved", { timeout: 20_000 }, () => {
  describe("the list", () => {
    it("renders one card per saved course", () => {
      saved("DD2380", "DD2421");
      render(<Saved />);

      expect(screen.getAllByRole("article")).toHaveLength(2);
      expect(
        screen.getByRole("heading", { name: "DD2380 Artificial Intelligence" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "DD2421 Machine Learning" }),
      ).toBeInTheDocument();
    });

    // `reviews` is empty, so this is the state nearly every card is in.
    it("says a course has no reviews rather than scoring it zero", () => {
      saved("DD2380");
      render(<Saved />);

      // The card says it twice: once where the examination split would be, and
      // once where the happy-took percentage would be. Neither becomes a zero.
      expect(screen.getAllByText("No reviews yet")).not.toHaveLength(0);
      expect(screen.queryByText("0%")).toBeNull();
    });

    // Explore's split Save button has nothing to offer on a page where every
    // card is already saved, so the picker stands alone (#68, #90).
    it("gives each card the picker rather than a Save button", () => {
      saved("DD2380");
      render(<Saved />);

      expect(screen.queryByRole("button", { name: "Save course" })).toBeNull();
      expect(
        screen.getByRole("button", { name: "Add to collection" }),
      ).toBeInTheDocument();
    });

    // #68's settled decision 1: there is no AI-comparison feature, so the word
    // is gone from the copy as well as from the identifiers.
    it("never says comparison", () => {
      saved("DD2380");
      const { container } = render(<Saved />);

      expect(container.textContent).not.toMatch(/comparison/i);
    });

    it("shows placeholders rather than an empty list while loading", () => {
      saved("DD2380");
      summariesPending.mockReturnValue(true);
      render(<Saved />);

      expect(screen.queryByRole("article")).toBeNull();
      expect(screen.queryByText("No saved courses yet")).toBeNull();
    });
  });

  /**
   * A save whose `course.summary` does not answer is still a save: the row is
   * in `user_saved_courses` and only the catalogue read failed. Dropping it
   * would make the page under-report what the reader has, and a page where
   * every read failed would claim they have saved nothing at all.
   */
  describe("a course whose details will not load", () => {
    it("says so, and keeps the courses that did load", () => {
      saved("DD2380", "ZZ9999");
      render(<Saved />);

      expect(screen.getAllByRole("article")).toHaveLength(1);
      expect(
        screen.getByText(/1 saved course could not be loaded/),
      ).toBeInTheDocument();
      expect(screen.getByText(/It is still saved/)).toBeInTheDocument();
    });

    it("never falls through to the empty state when every one failed", () => {
      saved("ZZ9999", "ZZ8888");
      render(<Saved />);

      expect(screen.queryByText("No saved courses yet")).toBeNull();
      expect(
        screen.getByText(/2 saved courses could not be loaded/),
      ).toBeInTheDocument();
    });
  });

  describe("the empty state", () => {
    it("is the designed one, not a blank list", () => {
      render(<Saved />);

      expect(screen.getByText("No saved courses yet")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Explore courses and save the ones you want to revisit.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("article")).toBeNull();
    });

    it("sends the reader to Explore", async () => {
      render(<Saved />);

      await userEvent.click(
        screen.getByRole("button", { name: "Explore courses" }),
      );
      expect(push).toHaveBeenCalledWith("/search");
    });
  });

  describe("unsaving", () => {
    function removeButtonFor(courseCode: string) {
      return within(cardFor(courseCode)).getByRole("button", {
        name: `Remove ${courseCode} from saved courses`,
      });
    }

    it("removes the save", async () => {
      saved("DD2380", "DD2421");
      render(<Saved />);

      await userEvent.click(removeButtonFor("DD2380"));

      expect(setSaved).toHaveBeenCalledExactlyOnceWith("DD2380", false);
    });

    /**
     * The independence rule. Saving, taking and reviewing are three separate
     * relationships (`CONTEXT.md`), and `saved.unsave` deletes one row that
     * neither taken history nor reviews has a foreign key to. The screen must
     * not imply otherwise, in copy or in writes.
     */
    it("leaves taken state alone", async () => {
      saved("DD2380", "DD2421");
      takenCourses.mockReturnValue([{ courseCode: "DD2421" }]);
      render(<Saved />);

      const takenPill = within(cardFor("DD2421")).getByTitle(
        /you marked it as taken/,
      );
      expect(takenPill).toBeInTheDocument();

      await userEvent.click(removeButtonFor("DD2380"));

      // The only write is the unsave; nothing reaches taken or the collections
      // the course may have been in.
      expect(setSaved).toHaveBeenCalledExactlyOnceWith("DD2380", false);
      expect(markTaken).not.toHaveBeenCalled();
      expect(removeCourse).not.toHaveBeenCalled();
      // And the course the reader kept is still marked taken.
      expect(
        within(cardFor("DD2421")).getByTitle(/you marked it as taken/),
      ).toBeInTheDocument();
    });

    it("never warns that unsaving takes anything else with it", () => {
      saved("DD2380");
      takenCourses.mockReturnValue([{ courseCode: "DD2380" }]);
      const { container } = render(<Saved />);

      expect(container.textContent).not.toMatch(/will also|also remove/i);
    });
  });
});
