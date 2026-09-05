import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary } from "@/types";
import { Explore } from "./explore";

const push = vi.fn();
const replace = vi.fn();
const useMe = vi.fn();
const useSearchCourses = vi.fn();

let search = "";
let containerWidth = 500;
let delayResizeObserver = false;
let resizeObserverCallbacks: ResizeObserverCallback[] = [];

function deliverResizeObservers() {
  for (const callback of resizeObserverCallbacks) {
    callback(
      [{ contentRect: { width: containerWidth } } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
  }
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/search",
  useSearchParams: () => new URLSearchParams(search),
}));

// Only the session hook is faked; `AuthReasonDialog` stays real, because whether
// a visitor is actually asked to sign in is the thing under test.
vi.mock("@/features/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth")>()),
  useMe: () => useMe(),
}));

vi.mock("@/features/saved", () => ({
  useSetCourseSaved: () => ({ setSaved: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("@/features/courses/api/queries", () => ({
  useCourseDetails: () => ({ data: undefined }),
  useCourseSummaries: () => [],
  useCourseStats: () => ({ data: {} }),
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

// Explore owns the viewport contract; the pane's detailed content is covered
// in its own suite. This keeps the desktop interaction test focused on the
// host and avoids pulling its editor CSS into this screen test.
vi.mock("@/features/workspace/components/workspace-pane", () => ({
  WorkspacePane: () => <section aria-label="Open courses" />,
}));

// `toSearchCoursesInput` stays real: that the browser sends a star threshold and
// never a 1-10 score is the point of it (#67).
vi.mock("../api/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/queries")>()),
  useSearchCourses: (input: unknown) => useSearchCourses(input),
  useDepartments: () => ({ data: { departments: ["EECS", "ITM"] } }),
}));

function course(courseCode: string, titleEng: string): CourseSummary {
  return {
    courseCode,
    titleEng,
    currentStatus: "ESTABLISHED",
    credits: 6,
    creditUnit: "hp",
    department: "EECS",
    startTerms: [20252],
    examTypes: null,
    languages: ["English"],
    updatedAt: "2026-01-01",
  };
}

function searchState(over: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  };
}

function results(...courses: CourseSummary[]) {
  return searchState({
    data: { results: courses, total: courses.length, page: 1, pageSize: 10 },
  });
}

beforeEach(() => {
  search = "";
  containerWidth = 500;
  delayResizeObserver = false;
  resizeObserverCallbacks = [];
  window.sessionStorage.clear();
  push.mockClear();
  replace.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe() {
        resizeObserverCallbacks.push(this.callback);
        if (!delayResizeObserver) deliverResizeObservers();
      }

      disconnect() {}
      unobserve() {}
    },
  );
  useMe.mockReturnValue({ user: { userId: "u1", savedCourseCodes: [] } });
  useSearchCourses.mockReturnValue(results());
});

describe("Explore", () => {
  describe("the results list", () => {
    beforeEach(() => {
      search = "q=graphs";
      useSearchCourses.mockReturnValue(
        results(
          course("DD2380", "Artificial Intelligence"),
          course("DD1337", "Programming"),
        ),
      );
    });

    it("renders one card per result", () => {
      render(<Explore />);

      expect(screen.getAllByRole("article")).toHaveLength(2);
      expect(
        screen.getByRole("heading", { name: "DD2380 Artificial Intelligence" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "DD1337 Programming" }),
      ).toBeInTheDocument();
    });

    // The count is what came back, not what matched: `search.courses` returns one
    // page and post-filters after fetching, so "2 courses match" would be a
    // claim the server cannot support (#74).
    it("says how many results it is showing, not how many matched", () => {
      render(<Explore />);
      expect(screen.getByText("Showing 2 courses for “graphs”")).toBeVisible();
    });

    // `reviews` is empty, so this is the ordinary card, not an edge case — and
    // it says "no reviews yet" rather than scoring the course zero.
    it("has no reviews to show for them, which is not zero", () => {
      render(<Explore />);
      for (const card of screen.getAllByRole("article")) {
        expect(
          within(card).getAllByText("No reviews yet").length,
        ).toBeGreaterThan(0);
        expect(within(card).queryByText("0%")).not.toBeInTheDocument();
      }
    });

    it("opens a course in the mobile workspace sheet", async () => {
      render(<Explore />);
      await userEvent.click(
        within(screen.getAllByRole("article")[0] as HTMLElement).getByRole(
          "button",
          { name: /Artificial Intelligence/ },
        ),
      );
      expect(screen.getAllByText("DD2380 · Details")).toHaveLength(2);
      expect(
        screen.getByRole("button", { name: "Close DD2380 · Details" }),
      ).toBeVisible();
      expect(push).not.toHaveBeenCalled();

      await userEvent.click(
        screen.getByRole("button", { name: "Close DD2380 · Details" }),
      );
      expect(screen.queryByText("DD2380 · Details")).not.toBeInTheDocument();
    });

    it("dismisses the mobile workspace sheet when its handle is dragged down", async () => {
      render(<Explore />);
      await userEvent.click(
        within(screen.getAllByRole("article")[0] as HTMLElement).getByRole(
          "button",
          { name: /Artificial Intelligence/ },
        ),
      );

      const handle = screen.getByRole("button", {
        name: "Drag workspace sheet down to dismiss",
      });
      fireEvent.pointerDown(handle, { pointerId: 1, clientY: 10 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 160 });
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 160 });

      expect(screen.queryByText("DD2380 · Details")).not.toBeInTheDocument();
    });

    it("keeps the workspace sheet open when a drag is cancelled", async () => {
      render(<Explore />);
      await userEvent.click(
        within(screen.getAllByRole("article")[0] as HTMLElement).getByRole(
          "button",
          { name: /Artificial Intelligence/ },
        ),
      );

      const handle = screen.getByRole("button", {
        name: "Drag workspace sheet down to dismiss",
      });
      fireEvent.pointerDown(handle, { pointerId: 1, clientY: 10 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 160 });
      fireEvent.pointerCancel(handle, { pointerId: 1 });

      expect(
        screen.getByRole("button", { name: "Close DD2380 · Details" }),
      ).toBeVisible();
    });

    /**
     * The sheet locks the page's scroll, so it may only mount once the
     * container has been measured as narrow — but the open list is the same
     * either way, so the click itself never has to wait for that measurement.
     */
    it("holds a course open until its container chooses the mobile sheet", async () => {
      delayResizeObserver = true;
      render(<Explore />);

      await userEvent.click(
        within(screen.getAllByRole("article")[0] as HTMLElement).getByRole(
          "button",
          { name: /Artificial Intelligence/ },
        ),
      );
      expect(push).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await act(async () => deliverResizeObservers());

      expect(
        await screen.findByRole("button", { name: "Close DD2380 · Details" }),
      ).toBeVisible();
      expect(push).not.toHaveBeenCalled();
    });

    it("keeps the results as the only mobile scrolling surface", () => {
      render(<Explore />);

      expect(screen.getByTestId("explore-results")).toHaveClass(
        "scrollbar-hidden",
        "overflow-y-auto",
        "max-w-[1136px]",
      );
      expect(screen.queryByLabelText("Open courses")).not.toBeInTheDocument();
    });

    it("opens courses in the resizable desktop workspace", async () => {
      containerWidth = 900;
      render(<Explore />);

      await userEvent.click(
        within(screen.getAllByRole("article")[0] as HTMLElement).getByRole(
          "button",
          { name: /Artificial Intelligence/ },
        ),
      );

      expect(screen.getByLabelText("Open courses")).toBeInTheDocument();
      // What the handle does is asserted in `workspace-pane-host.spec.tsx`;
      // this screen only has to prove the column arrived with it.
      expect(
        screen.getByRole("button", { name: "Resize workspace" }),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    /**
     * There used to be a third presentation here: between the sheet's width and
     * the column's, a course opened on its own page. #68 §5 deleted that page,
     * so the widths either side of 768 have to cover the whole range between
     * them and nothing may route away.
     */
    it("opens the sheet rather than routing just below the column's width", async () => {
      containerWidth = 767;
      render(<Explore />);

      await userEvent.click(
        within(screen.getAllByRole("article")[0] as HTMLElement).getByRole(
          "button",
          { name: /Artificial Intelligence/ },
        ),
      );

      expect(
        screen.getByRole("button", { name: "Close DD2380 · Details" }),
      ).toBeVisible();
      expect(
        screen.queryByTestId("workspace-pane-host"),
      ).not.toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    // `/course/<code>` redirects here with the course it was asked for, so the
    // parameter has to land in the pane — and then leave, or every reload would
    // reopen a tab the reader had closed.
    describe("a course named by the route", () => {
      // A hand-typed `/course/dd2380` was a working URL, so the code is
      // upper-cased on the way in rather than sent to the catalogue as typed.
      it("opens it in the workspace, and takes the instruction back out of the URL", async () => {
        search = "q=graphs&open=dd2380&kind=review";
        render(<Explore />);

        expect(
          await screen.findByRole("button", {
            name: "Close DD2380 · Review draft",
          }),
        ).toBeVisible();
        await waitFor(() =>
          expect(replace).toHaveBeenCalledWith("/search?q=graphs", {
            scroll: false,
          }),
        );
      });

      it("opens the details tab when no kind is named", async () => {
        search = "q=graphs&open=DD2380";
        render(<Explore />);

        expect(
          await screen.findByRole("button", { name: "Close DD2380 · Details" }),
        ).toBeVisible();
      });
    });

    it("stops resizing when a pointer gesture is cancelled", async () => {
      containerWidth = 900;
      render(<Explore />);
      await userEvent.click(
        within(screen.getAllByRole("article")[0] as HTMLElement).getByRole(
          "button",
          { name: /Artificial Intelligence/ },
        ),
      );

      const host = screen.getByTestId("workspace-pane-host");
      const resize = screen.getByRole("button", { name: "Resize workspace" });
      // `900 - 396 - 18`: the pane takes what the results column's floor and
      // the row's gap leave it, rather than the 504px it opens at.
      expect(host).toHaveStyle({ width: "486px" });

      fireEvent.pointerDown(resize, { clientX: 500 });
      fireEvent.pointerCancel(window);
      fireEvent.pointerMove(window, { clientX: 800 });

      expect(host).toHaveStyle({ width: "486px" });
    });
  });

  describe("the empty state", () => {
    it("names the search that found nothing", () => {
      search = "q=nothing at all";
      render(<Explore />);

      expect(
        screen.getByText("No courses match “nothing at all”"),
      ).toBeVisible();
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
    });

    it("offers a way out of it", async () => {
      search = "q=nothing at all";
      render(<Explore />);

      await userEvent.click(
        screen.getByRole("button", { name: "clear the search" }),
      );
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith("/search", { scroll: false }),
      );
    });
  });

  describe("the initial state, with nothing searched yet", () => {
    it("says what to type rather than showing a blank column", () => {
      render(<Explore />);

      expect(screen.getByText("Search the KTH catalogue")).toBeVisible();
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
      // Nothing is claimed about a catalogue nobody has searched.
      expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
    });

    it("runs a suggestion on one click", async () => {
      render(<Explore />);

      await userEvent.click(
        screen.getByRole("button", { name: "machine learning" }),
      );

      expect(screen.getByLabelText("Search courses")).toHaveValue(
        "machine learning",
      );
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith("/search?q=machine+learning", {
          scroll: false,
        }),
      );
    });
  });

  // The field and `?q=` are two copies of one thing, and the hook has to decide
  // which of them moved. Getting it wrong is silent: the mirror wins every
  // argument and a Back click is undone before the reader sees it.
  describe("the query, in the URL and in the field", () => {
    it("writes what was typed into the URL, so the search can be shared", async () => {
      render(<Explore />);

      await userEvent.type(
        screen.getByLabelText("Search courses"),
        "graph theory",
      );

      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith("/search?q=graph+theory", {
          scroll: false,
        }),
      );
    });

    // `router.replace` does not land in `useSearchParams` synchronously, and the
    // query's debounce and a filter click fire at independent moments. A write
    // that read the URL it was about to change would build on a snapshot the
    // other write had already superseded, and the address bar would end up
    // holding one of the two — so a reload or a shared link silently lost the
    // other. The mock router here never updates `search`, which is exactly that
    // window held open.
    describe("a filter changed while the typed query is still settling", () => {
      it("keeps both, with the query committed first", async () => {
        render(<Explore />);

        await userEvent.type(screen.getByLabelText("Search courses"), "graphs");
        await waitFor(() =>
          expect(replace).toHaveBeenCalledWith("/search?q=graphs", {
            scroll: false,
          }),
        );
        await userEvent.selectOptions(screen.getByLabelText("School"), "EECS");

        expect(replace).toHaveBeenLastCalledWith(
          "/search?q=graphs&department=EECS",
          { scroll: false },
        );
      });

      it("keeps both, with the filter committed first", async () => {
        render(<Explore />);

        await userEvent.selectOptions(screen.getByLabelText("School"), "EECS");
        expect(replace).toHaveBeenLastCalledWith("/search?department=EECS", {
          scroll: false,
        });

        await userEvent.type(screen.getByLabelText("Search courses"), "graphs");

        await waitFor(() =>
          expect(replace).toHaveBeenLastCalledWith(
            "/search?department=EECS&q=graphs",
            { scroll: false },
          ),
        );
      });
    });

    it("adopts a query that arrives from outside, rather than overwriting it", async () => {
      search = "q=graphs";
      const { rerender } = render(<Explore />);
      expect(screen.getByLabelText("Search courses")).toHaveValue("graphs");

      // What Back does: the URL moves under a mounted page.
      search = "q=compilers";
      rerender(<Explore />);

      await waitFor(() =>
        expect(screen.getByLabelText("Search courses")).toHaveValue(
          "compilers",
        ),
      );
      // And the mirror does not push the old query back over it.
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe("a visitor", () => {
    beforeEach(() => {
      useMe.mockReturnValue({ user: null });
      search = "q=graphs";
      useSearchCourses.mockReturnValue(
        results(course("DD2380", "Artificial Intelligence")),
      );
    });

    it("may search and browse without an account", () => {
      render(<Explore />);

      expect(
        screen.getByRole("heading", { name: "DD2380 Artificial Intelligence" }),
      ).toBeVisible();
      expect(screen.getByLabelText("Search courses")).toBeEnabled();
    });

    it("is asked to sign in only when they try to save", async () => {
      render(<Explore />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: "Save course" }),
      );

      expect(
        await screen.findByText("Sign in to save this course"),
      ).toBeVisible();
    });
  });

  describe("the filters", () => {
    beforeEach(() => {
      search = "q=graphs";
    });

    // The dropdown asks for stars; `search/service.ts` converts to the stored
    // 1-10 scale and thresholds the learning mean alone (#67).
    it("sends the rating threshold in stars", async () => {
      render(<Explore />);

      await userEvent.selectOptions(
        screen.getByLabelText("Minimum rating"),
        "4",
      );

      expect(replace).toHaveBeenCalledWith("/search?q=graphs&rating=4", {
        scroll: false,
      });
    });

    it("offers the schools the catalogue actually holds", () => {
      render(<Explore />);
      const school = screen.getByLabelText("School");
      expect(
        within(school).getByRole("option", { name: "EECS" }),
      ).toBeInTheDocument();
      expect(
        within(school).getByRole("option", { name: "ITM" }),
      ).toBeInTheDocument();
    });

    it("keeps both filters in the URL, so a filtered search is shareable", async () => {
      search = "q=graphs&department=EECS&rating=3";
      render(<Explore />);

      expect(screen.getByLabelText("School")).toHaveValue("EECS");
      expect(screen.getByLabelText("Minimum rating")).toHaveValue("3");

      await userEvent.click(
        screen.getByRole("button", { name: "Clear filters" }),
      );
      expect(replace).toHaveBeenCalledWith("/search?q=graphs", {
        scroll: false,
      });
    });

    // A hand-edited threshold outside 1-5 would be rejected by the procedure.
    it("ignores a rating the procedure would reject", () => {
      search = "q=graphs&rating=9";
      render(<Explore />);
      expect(screen.getByLabelText("Minimum rating")).toHaveValue("");
      expect(useSearchCourses).toHaveBeenCalledWith(
        expect.objectContaining({ minRating: undefined }),
      );
    });
  });

  describe("while the catalogue is answering", () => {
    it("shows the skeleton instead of an empty column", () => {
      search = "q=graphs";
      useSearchCourses.mockReturnValue(searchState({ isFetching: true }));
      render(<Explore />);

      expect(screen.getAllByTestId("explore-skeleton")).toHaveLength(3);
      expect(screen.getByText("Loading courses…")).toBeVisible();
    });

    it("offers a retry when it does not answer", async () => {
      search = "q=graphs";
      const refetch = vi.fn();
      useSearchCourses.mockReturnValue(searchState({ isError: true, refetch }));
      render(<Explore />);

      expect(
        screen.getByText("The course catalogue did not answer"),
      ).toBeVisible();
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(refetch).toHaveBeenCalled();
    });
  });
});
