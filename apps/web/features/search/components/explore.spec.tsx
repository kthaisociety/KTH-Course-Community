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
import {
  SEARCH_MORPH_KEY,
  stashSearchBarHandoff,
} from "@/features/shell/lib/search-morph";
import { WORKSPACE_COLUMN_FROM } from "@/features/workspace";
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

const toggleGuestSave = vi.fn();
vi.mock("@/features/saved", () => ({
  useSetCourseSaved: () => ({ setSaved: vi.fn().mockResolvedValue(undefined) }),
  useGuestSaves: () => [],
  toggleGuestSave: (courseCode: string, saved: boolean) =>
    toggleGuestSave(courseCode, saved),
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

// `toSearchCoursesInput` stays real: exactly which filters reach `search.courses`
// is the point of it, and a removed one must not reappear on the wire.
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
  return pageOf({ courses });
}

/**
 * A reply from `search.courses` as it is shaped now: which page was served, and
 * whether another follows. There is no `total` — the server cannot count a
 * de-duplicated union of a keyword ranking and a semantic one, and #148 removed
 * the `total: results.length` that pretended otherwise.
 */
function pageOf(
  data: { courses?: CourseSummary[]; page?: number; hasMore?: boolean },
  over: Record<string, unknown> = {},
) {
  return searchState({
    data: {
      results: data.courses ?? [],
      page: data.page ?? 1,
      pageSize: 20,
      hasMore: data.hasMore ?? false,
    },
    ...over,
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
    // page of a de-duplicated union of two rankings and cannot count the rest,
    // so "2 courses match" would be a claim the server cannot support (#74,
    // and #148 for the pager that count would need).
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

    // Saving is not one of the things that needs an account. The Saved
    // artboard keeps a signed-out reader's list in the browser and offers to
    // move it into an account later, so the save lands and no dialog opens.
    it("saves to the browser without being asked to sign in", async () => {
      render(<Explore />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: "Save course" }),
      );

      expect(toggleGuestSave).toHaveBeenCalledWith("DD2380", true);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("the filters", () => {
    beforeEach(() => {
      search = "q=graphs";
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

    it("keeps the school in the URL, so a filtered search is shareable", async () => {
      search = "q=graphs&department=EECS";
      render(<Explore />);

      expect(screen.getByLabelText("School")).toHaveValue("EECS");

      await userEvent.click(
        screen.getByRole("button", { name: "Clear filters" }),
      );
      expect(replace).toHaveBeenCalledWith("/search?q=graphs", {
        scroll: false,
      });
    });

    /**
     * The minimum-rating filter was removed — it was in no artboard, and it was
     * applied after the query, so it could silently return short results. Links
     * carrying `?rating=` were shareable while it existed, and they are still
     * out there.
     *
     * Such a link must be *boring*: no control comes back, the parameter is not
     * sent to `search.courses`, and the reader gets the unfiltered search the
     * link named. Not an error, not a warning, not an empty page.
     */
    it("ignores a stale ?rating= from an old shared link", () => {
      search = "q=graphs&department=EECS&rating=4";
      useSearchCourses.mockReturnValue(
        results(course("SF2740", "Graph Theory")),
      );
      render(<Explore />);

      expect(screen.queryByLabelText("Minimum rating")).not.toBeInTheDocument();
      expect(useSearchCourses).toHaveBeenCalledWith({
        q: "graphs",
        department: "EECS",
      });
      expect(
        screen.getByRole("heading", { name: "SF2740 Graph Theory" }),
      ).toBeVisible();
    });

    // Clearing must not depend on the removed filter: school alone still turns
    // "Clear filters" on, and clearing it turns the button back off.
    it("offers Clear filters for the school alone", async () => {
      search = "q=graphs";
      render(<Explore />);
      expect(
        screen.queryByRole("button", { name: "Clear filters" }),
      ).not.toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText("School"), "EECS");

      expect(replace).toHaveBeenCalledWith("/search?q=graphs&department=EECS", {
        scroll: false,
      });
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

    /**
     * `Course Community - Explore.dc.html` draws the panel's badge as
     * `#a3452a` over `#fbeceb` — `--cc-danger-ink` over `--cc-danger-tint`, the
     * pair the Design System artboard names as the error banner. It used to
     * derive the fill with
     * `color-mix(in srgb, var(--cc-danger) 12%, var(--cc-surface))` under a
     * comment claiming no error surface token existed. It did, the
     * mix landed on a pink rather than the token's warm peach, and no mix of
     * the solid could have reached it in dark, where the design states the tint
     * as alpha over the page instead.
     *
     * Classes rather than computed colours: jsdom runs no Tailwind, so what is
     * assertable is the token the component asked for, which is what regressed.
     */
    it("paints the badge in the danger tint family, not a colour-mixed derivation", () => {
      search = "q=graphs";
      useSearchCourses.mockReturnValue(searchState({ isError: true }));
      render(<Explore />);

      const badge = screen.getByText("The course catalogue did not answer")
        .previousElementSibling as HTMLElement;

      expect(badge).toHaveClass("bg-cc-danger-tint", "text-cc-danger-ink");
      expect(badge.className).not.toContain("color-mix");
    });
  });

  /**
   * The artboard's pager, built on a lookahead rather than a count.
   *
   * The whole contract is `hasMore` plus the page the server says it served.
   * There is no total — one page of a de-duplicated union of a keyword ranking
   * and a semantic one has no count behind it — so every assertion here is
   * about *whether there is another page*, never about how many there are.
   */
  describe("the pager", () => {
    // Exact names: the artboard's arrows are decoration and are hidden from
    // the accessibility tree, so the buttons are announced "Previous" and
    // "Next" rather than "left arrow Previous".
    const NEXT = { name: "Next" } as const;
    const PREVIOUS = { name: "Previous" } as const;

    function pager() {
      return screen.queryByRole("navigation", {
        name: "Search results pages",
      });
    }

    beforeEach(() => {
      search = "q=graphs";
    });

    it("is not drawn when there is only one page", () => {
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], hasMore: false }),
      );
      render(<Explore />);

      expect(pager()).not.toBeInTheDocument();
    });

    it("appears as soon as a page follows this one", () => {
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], hasMore: true }),
      );
      render(<Explore />);

      expect(pager()).toBeVisible();
      expect(screen.getByText("Page 1")).toBeVisible();
      expect(screen.getByRole("button", PREVIOUS)).toBeDisabled();
      expect(screen.getByRole("button", NEXT)).toBeEnabled();
    });

    // A last page still needs the control, or there is no way back off it.
    it("stays on a last page, with only the way back live", () => {
      search = "q=graphs&page=2";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], page: 2, hasMore: false }),
      );
      render(<Explore />);

      expect(screen.getByText("Page 2")).toBeVisible();
      expect(screen.getByRole("button", PREVIOUS)).toBeEnabled();
      expect(screen.getByRole("button", NEXT)).toBeDisabled();
    });

    // `push`, not `replace`: turning a page is a navigation, and Back must undo
    // it — unlike a search grown one keystroke at a time.
    it("turns the page by pushing it into the URL", async () => {
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], hasMore: true }),
      );
      render(<Explore />);

      await userEvent.click(screen.getByRole("button", NEXT));

      expect(push).toHaveBeenCalledWith("/search?q=graphs&page=2", {
        scroll: false,
      });
      expect(replace).not.toHaveBeenCalled();
    });

    it("drops the parameter entirely on the way back to the first page", async () => {
      search = "q=graphs&page=2";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], page: 2, hasMore: false }),
      );
      render(<Explore />);

      await userEvent.click(screen.getByRole("button", PREVIOUS));

      expect(push).toHaveBeenCalledWith("/search?q=graphs", { scroll: false });
    });

    it("asks the server for the page the URL names", () => {
      search = "q=graphs&page=3";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], page: 3, hasMore: true }),
      );
      render(<Explore />);

      expect(useSearchCourses).toHaveBeenLastCalledWith({
        q: "graphs",
        department: undefined,
        page: 3,
      });
    });

    /**
     * The first page sends no `page` at all. react-query hashes a key by its
     * contents, so `{ q }` and `{ q, page: 1 }` would be two keys for one
     * answer — and Taken courses reuses this hook without paging at all.
     */
    it("sends no page for the first one, so the key is the unpaged one", () => {
      useSearchCourses.mockReturnValue(pageOf({ hasMore: true }));
      render(<Explore />);

      const input = useSearchCourses.mock.calls.at(-1)?.[0] as {
        page?: number;
      };
      expect(input.page).toBeUndefined();
    });

    /**
     * `?page=` past the server's depth cap. The server clamps and says which
     * page it served; the pager reads that rather than the address bar, so the
     * reader is told where they actually are.
     *
     * Nothing corrects the URL. An effect writing the state it reads is how the
     * last three render loops in this page started, and the reader's next click
     * writes a truthful number anyway.
     */
    it("names the page the server served, not the one the URL asked for", () => {
      search = "q=graphs&page=99";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], page: 5, hasMore: false }),
      );
      render(<Explore />);

      expect(screen.getByText("Page 5")).toBeVisible();
      expect(screen.queryByText("Page 99")).not.toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it("steps back from a clamped page onto the one before it", async () => {
      search = "q=graphs&page=99";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], page: 5, hasMore: false }),
      );
      render(<Explore />);

      await userEvent.click(screen.getByRole("button", PREVIOUS));

      expect(push).toHaveBeenCalledWith("/search?q=graphs&page=4", {
        scroll: false,
      });
    });

    /**
     * `keepPreviousData` keeps the previous page's rows on screen while the
     * next page loads, which is what stops the column flashing empty. Its
     * `page` and `hasMore` describe that *previous* request, so reading them
     * here would label the flight to page 2 "Page 1" and flip both buttons
     * twice on the way.
     */
    it("does not take the page number off a stale reply mid-flight", () => {
      search = "q=graphs&page=2";
      useSearchCourses.mockReturnValue(
        pageOf(
          { courses: [course("DD2380", "AI")], page: 1, hasMore: true },
          { isPlaceholderData: true },
        ),
      );
      render(<Explore />);

      expect(screen.getByText("Page 2")).toBeVisible();
      expect(screen.queryByText("Page 1")).not.toBeInTheDocument();
    });

    // An empty first page means nothing matched. An empty later one means the
    // ranking ran out behind the page that was asked for, which is a different
    // sentence and a different way out.
    it("says a page is past the end rather than that nothing matched", async () => {
      search = "q=graphs&page=3";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [], page: 3, hasMore: false }),
      );
      render(<Explore />);

      expect(screen.getByText("Nothing on page 3")).toBeVisible();
      expect(
        screen.queryByText("No courses match “graphs”"),
      ).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: "Back to the first page" }),
      );
      expect(push).toHaveBeenCalledWith("/search?q=graphs", { scroll: false });
    });

    // The live region and the panel are one message in two places; they must
    // not disagree about what happened.
    it("tells the live region the same thing the panel says", () => {
      search = "q=graphs&page=3";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [], page: 3, hasMore: false }),
      );
      render(<Explore />);

      expect(
        screen.getByText("No courses on page 3 for \u201Cgraphs\u201D"),
      ).toBeVisible();
    });

    it("still says nothing matched on an empty first page", () => {
      useSearchCourses.mockReturnValue(pageOf({ courses: [] }));
      render(<Explore />);

      expect(screen.getByText("No courses match “graphs”")).toBeVisible();
      expect(screen.queryByText(/^Nothing on page/)).not.toBeInTheDocument();
    });

    // Narrowing to one school shortens the ranking, so page 3 of the unfiltered
    // search is very often past the end of the filtered one.
    it("returns to the first page when the school changes", async () => {
      search = "q=graphs&page=3";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], page: 3, hasMore: true }),
      );
      render(<Explore />);

      await userEvent.selectOptions(screen.getByLabelText("School"), "EECS");

      expect(replace).toHaveBeenLastCalledWith(
        "/search?q=graphs&department=EECS",
        { scroll: false },
      );
    });

    it("returns to the first page when the search changes", async () => {
      search = "q=graphs&page=3";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], page: 3, hasMore: true }),
      );
      render(<Explore />);

      await userEvent.type(screen.getByLabelText("Search courses"), " theory");

      await waitFor(() =>
        expect(replace).toHaveBeenLastCalledWith("/search?q=graphs+theory", {
          scroll: false,
        }),
      );
    });

    /**
     * The page now lives in the URL, and the URL is what `setParams` is rebuilt
     * from. An effect that wrote it back on mount would be a loop with fuel —
     * three have shipped in this repo. Nothing here writes on arrival, under a
     * Strict Mode double mount included.
     */
    it("writes nothing to the URL merely by opening on a deep page", () => {
      search = "q=graphs&page=3";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], page: 3, hasMore: true }),
      );
      render(<Explore />);

      expect(push).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    // A `?page=` with nothing searched has no page to go back to, only a
    // number in the address bar. The start-here panel is what that moment is
    // for, and a pager over it would offer to leave a search nobody has run.
    it("is not drawn over the start-here panel", () => {
      search = "page=3";
      useSearchCourses.mockReturnValue(pageOf({ hasMore: true }));
      render(<Explore />);

      expect(screen.getByText("Search the KTH catalogue")).toBeVisible();
      expect(pager()).not.toBeInTheDocument();
    });

    // Nor over the error panel: the last good answer is still in `data`, and
    // paging off it would ask for a page of a search that just failed.
    it("is not drawn when the catalogue did not answer", () => {
      search = "q=graphs&page=2";
      useSearchCourses.mockReturnValue(
        pageOf(
          { courses: [course("DD2380", "AI")], page: 2, hasMore: true },
          { isError: true },
        ),
      );
      render(<Explore />);

      expect(
        screen.getByText("The course catalogue did not answer"),
      ).toBeVisible();
      expect(pager()).not.toBeInTheDocument();
    });

    it("ignores a ?page= that is not a page", () => {
      search = "q=graphs&page=not-a-number";
      useSearchCourses.mockReturnValue(
        pageOf({ courses: [course("DD2380", "AI")], hasMore: true }),
      );
      render(<Explore />);

      const input = useSearchCourses.mock.calls.at(-1)?.[0] as {
        page?: number;
      };
      expect(input.page).toBeUndefined();
      expect(screen.getByText("Page 1")).toBeVisible();
    });
  });

  /**
   * The receiving end of the landing → Explore transition. Every rule about
   * *when* the bar continues — consumed once, never stale, dropped under reduced
   * motion — belongs to the seam that owns it, in
   * `features/shell/components/search-morph.spec.tsx`. What is Explore's own is
   * that its search bar is the element the handoff lands on at all.
   */
  describe("continuing the landing page's search bar", () => {
    const LANDING_BAR = { left: 140, top: 400, width: 560, height: 42 };
    const RESTING = { left: 320, top: 20, width: 560, height: 42 };

    function bar() {
      return screen.getByLabelText("Search courses").closest("form");
    }

    it("animates its own bar out of the box the landing left it in", () => {
      const measure = vi
        .spyOn(HTMLFormElement.prototype, "getBoundingClientRect")
        .mockReturnValue({
          ...RESTING,
          x: RESTING.left,
          y: RESTING.top,
          right: RESTING.left + RESTING.width,
          bottom: RESTING.top + RESTING.height,
          toJSON: () => RESTING,
        } as DOMRect);
      try {
        stashSearchBarHandoff(LANDING_BAR);

        render(<Explore />);

        expect(bar()?.style.transform).toBe("translate3d(-180px, 380px, 0)");
        expect(window.sessionStorage.getItem(SEARCH_MORPH_KEY)).toBeNull();
      } finally {
        measure.mockRestore();
      }
    });

    it("renders with no animation when it was reached any other way", () => {
      render(<Explore />);

      expect(bar()?.style.transform).toBe("");
    });
  });

  /**
   * Where the search block leaves the tab strip.
   *
   * Explore and Saved both host the workspace pane, and the strip sits in the
   * row each of them puts below its header. Explore spends a search block on
   * the way there and Saved spends nothing, so the strips started 118px apart.
   * The block is one row now, and both pages measure the same token — Explore
   * as height, Saved as padding — so neither number can move without the other.
   *
   * jsdom lays nothing out, so these read the declarations rather than the
   * pixels. That is the same bargain `workspace-pane-host.spec.tsx` makes for
   * the `@3xl` gate, and it catches the thing that actually breaks: one side
   * being edited to a literal.
   */
  describe("the search block", () => {
    function block() {
      return screen.getByLabelText("Search courses").closest("search");
    }

    function bar() {
      return screen.getByLabelText("Search courses").closest("form");
    }

    it("is one row, at the height Saved reserves for it", () => {
      render(<Explore />);

      expect(block()).toHaveClass(
        "@3xl:h-[var(--cc-search-block-h)]",
        "@3xl:flex-row",
      );
    });

    /**
     * Only where there is a pane to line up with. Below `@3xl` the workspace is
     * a sheet, Saved reserves nothing, and the block keeps the two-row stack it
     * has always had — a phone measured with the row forced on it put the search
     * field at 128px to keep a filter beside it.
     */
    it("keeps its own stack where there is no tab strip to line up with", () => {
      render(<Explore />);

      expect(block()).toHaveClass("flex-col");
      expect(block()).not.toHaveClass("h-[var(--cc-search-block-h)]");
    });

    it("puts the school filter in the row rather than under it", () => {
      render(<Explore />);

      const row = block();
      expect(row).not.toBeNull();
      expect(row).toContainElement(bar());
      expect(row).toContainElement(screen.getByLabelText("School"));
      // Siblings in the row, not the bar's own children: a filter is its own
      // committed choice and there is nothing here for a submit to gather.
      expect(bar()).not.toContainElement(screen.getByLabelText("School"));
    });

    /**
     * 236px is the rail's width, so a right margin of it on a centred row puts
     * the bar on the viewport's centre line instead of the centre of the column
     * beside the rail.
     */
    it("shifts left by the rail's width", () => {
      render(<Explore />);

      expect(block()).toHaveClass("@3xl:mr-[236px]");
      expect(block()).not.toHaveClass("mr-[236px]");
    });

    /**
     * The gate is the **pane's** threshold, not the rail's, and the difference
     * is a whole rail width of viewport.
     *
     * `AppShell` names its own container and draws the rail at `@3xl/shell`, so
     * the rail arrives at a 768px viewport. Every `@3xl:` here is unqualified
     * and resolves against `PageColumn`'s container, which the rail has already
     * narrowed — so this block turns over at roughly a 1004px viewport instead.
     * That is the right one: it is the same query `WorkspacePaneHost` gates its
     * column on, the same box `useWorkspacePresentation` measures against
     * `WORKSPACE_COLUMN_FROM`, and the same query Saved reserves its space on.
     * Those four have to agree or the two tab strips part company, which is the
     * defect this block exists to fix.
     *
     * Asserted as the *absence* of the shell-scoped variant as well as the
     * presence of the plain one, because the two read almost identically and
     * swapping them is a one-character edit. It is also not merely cosmetic:
     * built against `@3xl/shell` and measured, the search field collapsed to
     * 0px at an 800px viewport and 33px at 1003px, because the correction takes
     * 236px out of a column the rail has already taken 236px out of.
     */
    it("turns over on the pane's threshold, not the rail's", () => {
      render(<Explore />);

      expect(WORKSPACE_COLUMN_FROM).toBe(768);
      for (const shellScoped of [
        "@3xl/shell:mr-[236px]",
        "@3xl/shell:flex-row",
        "@3xl/shell:h-[var(--cc-search-block-h)]",
      ]) {
        expect(block()).not.toHaveClass(shellScoped);
      }
    });

    /**
     * The bar is centred, not the bar and the filters together. "Clear filters"
     * joins the row whenever a school is chosen, and a centred group would shove
     * the field sideways each time it appeared — its resting position is what
     * the landing hand-off aims at. A flexible track on each side is what holds
     * it still, so the bar keeps its own place while the filters grow rightward.
     */
    it("keeps the bar's resting place when Clear filters joins the row", () => {
      search = "q=graphs";
      const plain = render(<Explore />);
      expect(
        screen.queryByRole("button", { name: "Clear filters" }),
      ).not.toBeInTheDocument();
      const spacer = bar()?.previousElementSibling;
      expect(spacer).toBe(block()?.firstElementChild);
      expect(spacer).toHaveClass("flex-1");
      plain.unmount();

      search = "q=graphs&department=EECS";
      render(<Explore />);

      expect(
        screen.getByRole("button", { name: "Clear filters" }),
      ).toBeVisible();
      // The same balancing track, on the same side of the same bar: the button
      // grows rightward off the field instead of pushing it.
      expect(bar()?.previousElementSibling).toBe(block()?.firstElementChild);
      expect(bar()?.previousElementSibling).toHaveClass("flex-1");
    });

    /**
     * One bar across two pages. `search-morph.tsx` animates the arriving bar
     * with `translate3d` alone and never interpolates width, so a hero bar of a
     * different size would snap at the moment of arrival.
     */
    it("takes the width the landing's hero bar is capped at", () => {
      render(<Explore />);

      expect(bar()).toHaveClass("max-w-[var(--cc-search-bar-w)]");
    });
  });
});
