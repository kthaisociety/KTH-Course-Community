import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseStats } from "@/types";
import { Saved } from "./saved";

const push = vi.fn();
const replace = vi.fn();
const collections = vi.fn();
const renameCollection = vi.fn();
const deleteCollection = vi.fn();
const useMe = vi.fn();
const setSaved = vi.fn();
const takenCourses = vi.fn();
const markTaken = vi.fn();
const addCourse = vi.fn();
const removeCourse = vi.fn();
const summariesPending = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/saved",
}));
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
  useCollections: () => ({
    data: collections(),
    isPending: false,
    isFetching: false,
  }),
  useTakenCourses: () => ({ data: takenCourses() }),
}));
vi.mock("@/features/courses/api/mutations", () => ({
  useCollectionMutations: () => ({
    create: { mutateAsync: vi.fn() },
    rename: { mutateAsync: renameCollection },
    deleteCollection: { mutateAsync: deleteCollection },
    reorder: { mutateAsync: vi.fn() },
    addCourse: { mutateAsync: addCourse },
    removeCourse: { mutateAsync: removeCourse },
  }),
  useMarkCourseTaken: () => ({ mutateAsync: markTaken }),
}));
vi.mock("../api/mutations", () => ({
  useSetCourseSaved: () => ({ setSaved }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// Saved owns the host contract; the pane's own content is covered in its
// suite. Stubbing it also keeps the review editor's CSS out of this screen
// test, which is what Explore's suite does for the same reason.
vi.mock("@/features/workspace/components/workspace-pane", () => ({
  WorkspacePane: () => <section aria-label="Open courses" />,
}));

/**
 * `course.summary` as both readers of it see it: Saved takes the catalogue
 * fields, and the embedded Collections section also reads `stats` off the same
 * object for the cards in a collection's detail.
 */
const CATALOGUE: Record<
  string,
  {
    courseCode: string;
    titleEng: string;
    credits: number;
    department: string;
    stats: CourseStats;
  }
> = {
  DD2380: {
    courseCode: "DD2380",
    titleEng: "Artificial Intelligence",
    credits: 6,
    department: "EECS",
    stats: { reviews: null, takenCount: 0 },
  },
  DD2421: {
    courseCode: "DD2421",
    titleEng: "Machine Learning",
    credits: 7.5,
    department: "EECS",
    stats: { reviews: null, takenCount: 0 },
  },
};

/** One collection as `collections.list` returns it. */
function collection(name: string, ...courseCodes: string[]) {
  return { id: `col-${name}`, name, courseCodes };
}

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
  collections.mockReturnValue([]);
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
    // is gone from the copy as well as from the identifiers. The whole page is
    // checked, embedded collections strip included — that strip is the last
    // place the substitution was half-finished, and it renders here rather than
    // on a route of its own.
    it("never offers to compare anything", () => {
      saved("DD2380");
      const { container } = render(<Saved />);

      expect(container.textContent).not.toMatch(/compar/i);
    });

    /**
     * #156, and `CONTEXT.md`'s **Collection**: a collection is a view over saved
     * courses, never a place they move to. The 2026-09-05 artboard says the same
     * — `savedCards` over every saved code, and no "Every saved course is in a
     * collection" panel, because there is no state where this list can be empty
     * while saves exist.
     */
    it("lists a course that is already in a collection", () => {
      saved("DD2380", "DD2421");
      collections.mockReturnValue([collection("Spring picks", "DD2380")]);
      render(<Saved />);

      expect(screen.getAllByRole("article")).toHaveLength(2);
      expect(
        screen.getByRole("heading", { name: "DD2380 Artificial Intelligence" }),
      ).toBeInTheDocument();
    });

    it("lists every saved course even when all of them are filed", () => {
      saved("DD2380", "DD2421");
      collections.mockReturnValue([
        collection("Spring picks", "DD2380"),
        collection("Maybe", "DD2421", "DD2380"),
      ]);
      render(<Saved />);

      expect(screen.getAllByRole("article")).toHaveLength(2);
      expect(
        screen.queryByText("Every saved course is in a collection"),
      ).toBeNull();
    });

    // The artboard's own heading and line (lines 129-131). The line is what
    // distinguishes this section from the `h1` of the same words above it.
    it("heads the list the way the artboard heads it", () => {
      saved("DD2380");
      render(<Saved />);

      const heading = screen.getByRole("heading", {
        level: 2,
        name: "Saved courses",
      });
      expect(heading).toBeVisible();
      expect(
        screen.getByText(
          /All the courses you have saved, including any already grouped into a collection\./,
        ),
      ).toBeVisible();
      // The superseded copy promised the opposite.
      expect(
        screen.queryByText(/but not yet added to a collection/),
      ).toBeNull();
    });

    /**
     * The 2026-09-05 artboard added `if (this.savedState.pickerFor) this.sv({
     * pickerFor: null })` to its document handler: a pointer down outside the
     * picker closes it, where before only the taken and overflow menus were
     * dismissed that way. The app already behaves this way — the picker's state
     * is per card, so `useDismissOnOutside` in `CourseCard` defines "elsewhere"
     * from the card's own DOM — and this holds it, because the artboard now
     * names it as a requirement rather than leaving it to the implementation.
     */
    it("closes an open collection picker when the reader points elsewhere", async () => {
      saved("DD2380");
      render(<Saved />);

      const trigger = screen.getByRole("button", { name: "Add to collection" });
      await userEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      await userEvent.click(
        screen.getByRole("heading", { level: 2, name: "Saved courses" }),
      );
      expect(trigger).toHaveAttribute("aria-expanded", "false");
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

  /**
   * `Course Community - Saved.dc.html` line 82 imports the Collections artboard
   * with `compact`. That embedding is the design's only way in to collections —
   * the artboard's rail has no entry for them — so it is part of this page
   * rather than a link away from it.
   */
  describe("the collections section", () => {
    it("is a row of chips above the saved courses", () => {
      saved("DD2380");
      collections.mockReturnValue([collection("Spring picks", "DD2380")]);
      render(<Saved />);

      expect(
        screen.getByRole("heading", { name: "Collections" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "New collection" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Open collection Spring picks" }),
      ).toBeInTheDocument();
    });

    // The artboard's own `showSavedSection: !collectionsOpenDetail`. The detail
    // is itself a list of these cards, so leaving both up would show one course
    // twice on one page.
    it("opens a collection here, and the saved list gets out of the way", async () => {
      saved("DD2380", "DD2421");
      collections.mockReturnValue([collection("Spring picks", "DD2380")]);
      render(<Saved />);

      expect(screen.getAllByRole("article")).toHaveLength(2);

      await userEvent.click(
        screen.getByRole("button", { name: "Open collection Spring picks" }),
      );

      expect(
        screen.getByRole("heading", { name: "Spring picks" }),
      ).toBeInTheDocument();
      // Only the one course in the collection, from the detail below the chips.
      expect(screen.getAllByRole("article")).toHaveLength(1);
      expect(
        screen.queryByRole("heading", { name: "DD2421 Machine Learning" }),
      ).toBeNull();
    });

    // The detail is shareable from the page it was opened on, not from
    // `/collections`: this is where the design puts the way in.
    it("keeps the open collection in this route's query", async () => {
      saved("DD2380");
      collections.mockReturnValue([collection("Spring picks", "DD2380")]);
      render(<Saved />);

      await userEvent.click(
        screen.getByRole("button", { name: "Open collection Spring picks" }),
      );

      expect(replace).toHaveBeenCalledWith(
        "/saved?collection=col-Spring%20picks",
        {
          scroll: false,
        },
      );
    });

    it("opens the collection the route names, on the first paint", () => {
      saved("DD2380");
      collections.mockReturnValue([collection("Spring picks", "DD2380")]);
      render(<Saved openCollectionId="col-Spring picks" />);

      expect(
        screen.getByRole("heading", { name: "Spring picks" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("No saved courses yet")).toBeNull();
    });
  });

  /**
   * #68 §5 deleted the course page, and #127 §3 mounts the pane here: a course
   * opened from this screen — from a card, or named by the route because a
   * collection detail sent it back — opens as a tab beside the list rather than
   * navigating away from it.
   */
  describe("the workspace pane", () => {
    it("opens a course from a card without leaving the page", async () => {
      saved("DD2380");
      render(<Saved />);

      expect(screen.queryByTestId("workspace-pane-host")).toBeNull();

      await userEvent.click(
        within(cardFor("DD2380")).getByRole("button", {
          name: /Artificial Intelligence/,
        }),
      );

      expect(screen.getByTestId("workspace-pane-host")).toBeInTheDocument();
      expect(screen.getByLabelText("Open courses")).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("opens a review draft from the card's own control", async () => {
      saved("DD2380");
      render(<Saved />);

      await userEvent.click(
        within(cardFor("DD2380")).getByRole("button", {
          name: "Write a review",
        }),
      );

      expect(screen.getByTestId("workspace-pane-host")).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("opens the course the route names, and spends the instruction", () => {
      saved("DD2380");
      render(<Saved openCourse={{ courseCode: "DD2380", kind: "review" }} />);

      expect(screen.getByTestId("workspace-pane-host")).toBeInTheDocument();
      expect(replace).toHaveBeenCalledWith("/saved", { scroll: false });
    });

    // A course opened from inside a collection comes back through this route,
    // so clearing `?open=` must not close the detail it was opened from.
    it("keeps the open collection when it clears the instruction", () => {
      saved("DD2380");
      collections.mockReturnValue([collection("Spring picks", "DD2380")]);
      render(
        <Saved
          openCollectionId="col-Spring picks"
          openCourse={{ courseCode: "DD2380", kind: "details" }}
        />,
      );

      expect(replace).toHaveBeenCalledWith(
        "/saved?collection=col-Spring%20picks",
        { scroll: false },
      );
      expect(
        screen.getByRole("heading", { name: "Spring picks" }),
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

  /**
   * #155: deleting is confirmed *before* the write, not announced after it.
   * The artboards ask afterwards; the product decision overrides them, because
   * an unsave cascades the course out of every collection it was in and their
   * stored orders cannot be replayed back (`reorderCollectionCourses` refuses a
   * code that is not already a member).
   */
  describe("unsaving", () => {
    function removeButtonFor(courseCode: string) {
      return within(cardFor(courseCode)).getByRole("button", {
        name: `Remove ${courseCode} from saved courses`,
      });
    }

    it("asks before it writes anything", async () => {
      saved("DD2380", "DD2421");
      render(<Saved />);

      await userEvent.click(removeButtonFor("DD2380"));

      expect(
        screen.getByText("Remove DD2380 from your saved courses?"),
      ).toBeVisible();
      expect(setSaved).not.toHaveBeenCalled();
    });

    it("removes the save once the reader confirms", async () => {
      saved("DD2380", "DD2421");
      render(<Saved />);

      await userEvent.click(removeButtonFor("DD2380"));
      await userEvent.click(
        screen.getByRole("button", { name: "Remove course" }),
      );

      expect(setSaved).toHaveBeenCalledExactlyOnceWith("DD2380", false);
    });

    it("writes nothing when the reader keeps the course", async () => {
      saved("DD2380", "DD2421");
      render(<Saved />);

      await userEvent.click(removeButtonFor("DD2380"));
      await userEvent.click(
        screen.getByRole("button", { name: "Keep it saved" }),
      );

      expect(setSaved).not.toHaveBeenCalled();
      expect(
        screen.queryByText("Remove DD2380 from your saved courses?"),
      ).toBeNull();
      expect(cardFor("DD2380")).toBeInTheDocument();
    });

    // Dismissing is answering "keep it": the destructive half of the question
    // is never the one a stray Escape reaches.
    it("writes nothing when the question is dismissed", async () => {
      saved("DD2380");
      render(<Saved />);

      await userEvent.click(removeButtonFor("DD2380"));
      await userEvent.keyboard("{Escape}");

      expect(setSaved).not.toHaveBeenCalled();
    });

    /**
     * The confirmation names the one thing that really does go with the save —
     * the course's place in the collections holding it, cascaded off
     * `user_saved_courses` — and promises the two relationships that do not.
     */
    it("names the collections it cascades, and clears reviews and taken", async () => {
      saved("DD2380");
      render(<Saved />);

      await userEvent.click(removeButtonFor("DD2380"));

      const question = screen.getByText(/leaves this list and any collection/);
      expect(question).toBeVisible();
      expect(question.textContent).toMatch(
        /reviews and the courses you have marked as taken are untouched/i,
      );
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
      await userEvent.click(
        screen.getByRole("button", { name: "Remove course" }),
      );

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

    it("never warns that unsaving takes anything else with it", async () => {
      saved("DD2380");
      takenCourses.mockReturnValue([{ courseCode: "DD2380" }]);
      const { container } = render(<Saved />);

      expect(container.textContent).not.toMatch(/will also|also remove/i);

      // Including inside the confirmation, which is the one place on this page
      // that could plausibly overclaim what an unsave reaches.
      await userEvent.click(removeButtonFor("DD2380"));
      expect(document.body.textContent).not.toMatch(/will also|also remove/i);
      expect(document.body.textContent).not.toMatch(/delete your review/i);
    });
  });
});
