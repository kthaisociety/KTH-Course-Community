import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COLLAPSED_CARD_GEOMETRY,
  EXPANDED_CARD_GEOMETRY,
} from "@/features/courses/lib/card-geometry";
import { Collections } from "./collections";

/**
 * The Collections page against mocked procedures.
 *
 * The api modules are mocked rather than the barrel, so the real
 * `CourseCardItem` renders — the detail's rows are cards, and a stub would hide
 * whether the remove button the page asks for is the one the card draws.
 */

const useMe = vi.fn();
const useCollections = vi.fn();
const useCourseSummaries = vi.fn();

const create = vi.fn();
const rename = vi.fn();
const deleteCollection = vi.fn();
const reorder = vi.fn();
const addCourse = vi.fn();
const removeCourse = vi.fn();

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/collections",
}));
vi.mock("@/features/auth", () => ({
  useMe: () => useMe(),
  AuthReasonDialog: () => null,
}));
vi.mock("@/features/saved", () => ({
  useSetCourseSaved: () => ({ setSaved: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/features/courses/api/queries", () => ({
  useCollections: (enabled: boolean) => useCollections(enabled),
  useCourseSummaries: (codes: string[], enabled?: boolean) =>
    useCourseSummaries(codes, enabled),
  useTakenCourses: () => ({ data: [] }),
  useCourseDetails: () => ({ data: undefined }),
}));
vi.mock("@/features/courses/api/mutations", () => ({
  useCollectionMutations: () => ({
    create: { mutateAsync: create },
    rename: { mutateAsync: rename },
    deleteCollection: { mutateAsync: deleteCollection },
    reorder: { mutateAsync: reorder },
    addCourse: { mutateAsync: addCourse },
    removeCourse: { mutateAsync: removeCourse },
  }),
  useMarkCourseTaken: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/*
 * This page measures its own column through `useResultsWidth`, which lives in
 * the workspace barrel — and the barrel also carries the pane, which carries the
 * review editor and its stylesheet. Stubbing the pane is what keeps that CSS out
 * of a suite that never renders one, exactly as Saved's and Explore's suites do
 * for the pane they *do* mount.
 */
vi.mock("@/features/workspace/components/workspace-pane", () => ({
  WorkspacePane: () => null,
}));

const TITLES: Record<string, string> = {
  AA1000: "Alpha",
  BB2000: "Beta",
  CC3000: "Gamma",
  DD4000: "Delta",
};

/** `course.summary` as the page reads it: catalogue fields plus card numbers. */
function summaryOf(courseCode: string) {
  return {
    data: {
      courseCode,
      titleEng: TITLES[courseCode] ?? courseCode,
      credits: 6,
      department: "EECS",
      stats: { reviews: null, takenCount: 0 },
    },
  };
}

type Setup = {
  savedCourseCodes?: string[];
  collections?: Array<{ id: string; name: string; courseCodes: string[] }>;
  signedIn?: boolean;
};

function setup({
  savedCourseCodes = [],
  collections = [],
  signedIn = true,
}: Setup = {}) {
  useMe.mockReturnValue({
    user: signedIn ? { userId: "u1", savedCourseCodes } : null,
    isLoading: false,
  });
  useCollections.mockReturnValue({
    data: signedIn ? collections : undefined,
    isPending: !signedIn,
    isFetching: false,
  });
  useCourseSummaries.mockImplementation((codes: string[]) =>
    codes.map(summaryOf),
  );
}

beforeEach(() => {
  create.mockResolvedValue({ id: "new", name: "New", courseCodes: [] });
  rename.mockResolvedValue(undefined);
  deleteCollection.mockResolvedValue({ id: "c1" });
  reorder.mockResolvedValue(undefined);
  addCourse.mockResolvedValue(undefined);
  removeCourse.mockResolvedValue(undefined);
  setup();
});

describe("no collections yet", () => {
  it("says so, and offers the one thing there is to do", async () => {
    setup({ savedCourseCodes: ["AA1000"] });
    render(<Collections />);

    expect(screen.getByText("No collections yet")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create collection" }),
    ).toBeVisible();
    // Nothing to list, so the grid and its "New collection" tile stay away.
    expect(
      screen.queryByRole("button", { name: /^New collection/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the new-collection dialog from it", async () => {
    setup({ savedCourseCodes: ["AA1000"] });
    render(<Collections />);

    await userEvent.click(
      screen.getByRole("button", { name: "Create collection" }),
    );
    expect(screen.getByLabelText("Collection name")).toBeVisible();
  });
});

describe("an empty collection", () => {
  it("says it is empty rather than showing an empty list", () => {
    setup({
      savedCourseCodes: ["AA1000"],
      collections: [{ id: "c1", name: "Spring", courseCodes: [] }],
    });
    render(<Collections openCollectionId="c1" />);

    expect(screen.getByText("No courses in this collection")).toBeVisible();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("sends a viewer with nothing saved to Explore first", () => {
    setup({
      savedCourseCodes: [],
      collections: [{ id: "c1", name: "Spring", courseCodes: [] }],
    });
    render(<Collections openCollectionId="c1" />);

    expect(
      screen.getByText(/A collection can only hold courses you have saved/),
    ).toBeVisible();
    // Nothing is addable, so the control that would offer nothing is not drawn.
    expect(
      screen.queryByRole("button", { name: "Add course" }),
    ).not.toBeInTheDocument();
  });
});

describe("the saved-only rule", () => {
  // A course may only join a collection its owner has also saved. The picker is
  // built from the saved codes, so an unsaved course is never offered and the
  // server is never asked to refuse one.
  it("offers only saved courses the collection does not already hold", async () => {
    setup({
      savedCourseCodes: ["AA1000", "BB2000", "CC3000"],
      collections: [{ id: "c1", name: "Spring", courseCodes: ["AA1000"] }],
    });
    render(<Collections openCollectionId="c1" />);

    await userEvent.click(screen.getByRole("button", { name: "Add course" }));

    const offered = within(screen.getByRole("menu")).getAllByRole("menuitem");
    // Every saved course except the one the collection already holds, and
    // nothing from the catalogue that this viewer has not saved.
    expect(offered.map((item) => item.textContent)).toEqual([
      "BB2000Beta",
      "CC3000Gamma",
    ]);
    expect(screen.queryByText("DD4000")).not.toBeInTheDocument();
  });

  it("adds the course the reader picked", async () => {
    setup({
      savedCourseCodes: ["AA1000", "BB2000"],
      collections: [{ id: "c1", name: "Spring", courseCodes: ["AA1000"] }],
    });
    render(<Collections openCollectionId="c1" />);

    await userEvent.click(screen.getByRole("button", { name: "Add course" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /BB2000/ }));

    expect(addCourse).toHaveBeenCalledWith({
      collectionId: "c1",
      courseCode: "BB2000",
    });
  });

  it("offers only saved courses in the new-collection dialog too", async () => {
    setup({ savedCourseCodes: ["AA1000"] });
    render(<Collections />);

    await userEvent.click(
      screen.getByRole("button", { name: "Create collection" }),
    );

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toHaveAccessibleName(/AA1000/);
    expect(screen.queryByText("DD4000")).not.toBeInTheDocument();
  });
});

describe("reordering within a collection", () => {
  const COLLECTION = {
    id: "c1",
    name: "Spring",
    courseCodes: ["AA1000", "BB2000", "CC3000"],
  };

  it("sends the whole new order when a course moves up", async () => {
    setup({
      savedCourseCodes: COLLECTION.courseCodes,
      collections: [COLLECTION],
    });
    render(<Collections openCollectionId="c1" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Move BB2000 up" }),
    );

    expect(reorder).toHaveBeenCalledWith({
      collectionId: "c1",
      courseCodes: ["BB2000", "AA1000", "CC3000"],
    });
  });

  it("sends the whole new order when a course moves down", async () => {
    setup({
      savedCourseCodes: COLLECTION.courseCodes,
      collections: [COLLECTION],
    });
    render(<Collections openCollectionId="c1" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Move BB2000 down" }),
    );

    expect(reorder).toHaveBeenCalledWith({
      collectionId: "c1",
      courseCodes: ["AA1000", "CC3000", "BB2000"],
    });
  });

  it("cannot move the ends off the list", () => {
    setup({
      savedCourseCodes: COLLECTION.courseCodes,
      collections: [COLLECTION],
    });
    render(<Collections openCollectionId="c1" />);

    expect(
      screen.getByRole("button", { name: "Move AA1000 up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move CC3000 down" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move AA1000 down" }),
    ).toBeEnabled();
  });
});

/**
 * #68 §5 deleted the course page: a course opens as a tab in the workspace
 * pane, and this component hosts no pane. Saved does — it is also the only way
 * in to collections the design draws — so both controls hand the course to that
 * route, and carry the open collection with them so the detail the reader is
 * standing in survives the navigation.
 */
describe("course actions in a collection", () => {
  beforeEach(() => {
    setup({
      savedCourseCodes: ["AA1000"],
      collections: [{ id: "c1", name: "Spring", courseCodes: ["AA1000"] }],
    });
  });

  it("opens a course into Saved's workspace pane", async () => {
    render(<Collections openCollectionId="c1" />);

    await userEvent.click(screen.getByRole("button", { name: "AA1000 Alpha" }));

    expect(push).toHaveBeenCalledWith(
      "/saved?collection=c1&open=AA1000&kind=details",
    );
  });

  it("opens a review draft into the same pane", async () => {
    render(<Collections openCollectionId="c1" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Write a review" }),
    );

    expect(push).toHaveBeenCalledWith(
      "/saved?collection=c1&open=AA1000&kind=review",
    );
  });

  // The course page is gone; nothing here may keep a link to it alive.
  it("never routes to a course page", async () => {
    render(<Collections openCollectionId="c1" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Write a review" }),
    );

    for (const [href] of push.mock.calls) {
      expect(href).not.toMatch(/^\/course\//);
    }
  });
});

describe("the add-course menu", () => {
  it("closes on Escape and gives focus back to the trigger", async () => {
    setup({
      savedCourseCodes: ["AA1000", "BB2000"],
      collections: [{ id: "c1", name: "Spring", courseCodes: ["AA1000"] }],
    });
    render(<Collections openCollectionId="c1" />);

    const trigger = screen.getByRole("button", { name: "Add course" });
    await userEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeVisible();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("a collection that is not the viewer's", () => {
  // Ownership is scoped in the query, so a stranger's collection is absent
  // rather than refused, and the page says exactly what the server says.
  it("reads as not found, never as someone else's", () => {
    setup({
      collections: [{ id: "c1", name: "Spring", courseCodes: [] }],
    });
    render(<Collections openCollectionId="someone-elses" />);

    expect(screen.getByText("Collection not found")).toBeVisible();
    expect(screen.queryByText(/belongs to/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
  });

  // Creating a collection opens it before its refetch lands. Calling that frame
  // "not found" would accuse the app of losing what it had just made.
  it("waits rather than saying not found while the list is still arriving", () => {
    setup({ collections: [] });
    useCollections.mockReturnValue({
      data: [],
      isPending: false,
      isFetching: true,
    });
    render(<Collections openCollectionId="brand-new" />);

    expect(screen.queryByText("Collection not found")).not.toBeInTheDocument();
  });
});

describe("the grid", () => {
  it("lists a collection with its courses and its count", () => {
    setup({
      savedCourseCodes: ["AA1000", "BB2000"],
      collections: [
        { id: "c1", name: "Spring", courseCodes: ["AA1000", "BB2000"] },
      ],
    });
    render(<Collections />);

    const tile = screen.getByRole("button", {
      name: "Open collection Spring",
    }).parentElement as HTMLElement;
    expect(within(tile).getByText("Spring")).toBeVisible();
    expect(within(tile).getByText("Alpha")).toBeVisible();
    expect(within(tile).getByText("2 courses")).toBeVisible();
  });

  it("renames a collection from its menu", async () => {
    setup({
      collections: [{ id: "c1", name: "Spring", courseCodes: [] }],
    });
    render(<Collections />);

    await userEvent.click(
      screen.getByRole("button", { name: "More actions for Spring" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

    const field = screen.getByLabelText("Collection name");
    await userEvent.clear(field);
    await userEvent.type(field, "Autumn{Enter}");

    expect(rename).toHaveBeenCalledWith({
      collectionId: "c1",
      name: "Autumn",
    });
  });

  it("deletes a collection from its menu, once the reader confirms", async () => {
    setup({
      collections: [{ id: "c1", name: "Spring", courseCodes: [] }],
    });
    render(<Collections />);

    await userEvent.click(
      screen.getByRole("button", { name: "More actions for Spring" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(deleteCollection).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete collection" }),
    );
    expect(deleteCollection).toHaveBeenCalledWith({ collectionId: "c1" });
  });
});

/**
 * #155. Deletion was immediate and irreversible from all three entry points,
 * and the artboards confirm *after* — a note, with no undo on it. The product
 * decision overrides them, because the deletion genuinely cannot be undone:
 * restoring a collection means `create` plus one `addCourse` per course, since
 * `reorderCollectionCourses` throws `NotFoundError` for a code that is not
 * already a member, and `addCourseToCollection` throws `ForbiddenError` for a
 * course unsaved in between. A restore that can come back partial is not an
 * undo, so the question is asked while the answer still costs nothing.
 */
describe("deleting a collection", () => {
  const SPRING = { id: "c1", name: "Spring", courseCodes: ["AA1000"] };

  async function askFromTileMenu() {
    await userEvent.click(
      screen.getByRole("button", { name: "More actions for Spring" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
  }

  it("names the collection, and what survives it", async () => {
    setup({ savedCourseCodes: ["AA1000"], collections: [SPRING] });
    render(<Collections />);

    await askFromTileMenu();

    expect(screen.getByText("Delete “Spring”?")).toBeVisible();
    expect(screen.getByText(/The courses themselves stay saved/)).toBeVisible();
    expect(screen.getByText(/cannot be restored/)).toBeVisible();
  });

  it("writes nothing when the reader keeps the collection", async () => {
    setup({ savedCourseCodes: ["AA1000"], collections: [SPRING] });
    render(<Collections />);

    await askFromTileMenu();
    await userEvent.click(
      screen.getByRole("button", { name: "Keep collection" }),
    );

    expect(deleteCollection).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete “Spring”?")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open collection Spring" }),
    ).toBeVisible();
  });

  // Dismissing is answering "keep it".
  it("writes nothing when the question is dismissed", async () => {
    setup({ savedCourseCodes: ["AA1000"], collections: [SPRING] });
    render(<Collections />);

    await askFromTileMenu();
    await userEvent.keyboard("{Escape}");

    expect(deleteCollection).not.toHaveBeenCalled();
  });

  it("asks from the open collection's own Delete button", async () => {
    setup({ savedCourseCodes: ["AA1000"], collections: [SPRING] });
    render(<Collections openCollectionId="c1" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteCollection).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete collection" }),
    );
    expect(deleteCollection).toHaveBeenCalledWith({ collectionId: "c1" });
  });

  it("asks from the compact chip's menu", async () => {
    setup({ savedCourseCodes: ["AA1000"], collections: [SPRING] });
    render(<Collections compact />);

    await askFromTileMenu();
    expect(deleteCollection).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete collection" }),
    );
    expect(deleteCollection).toHaveBeenCalledWith({ collectionId: "c1" });
  });

  /**
   * The note after the fact stays — it is what says the deletion happened — but
   * it must never grow an Undo, because the procedures cannot deliver one.
   */
  it("says it happened, and offers no undo", async () => {
    setup({ savedCourseCodes: ["AA1000"], collections: [SPRING] });
    render(<Collections />);

    await askFromTileMenu();
    await userEvent.click(
      screen.getByRole("button", { name: "Delete collection" }),
    );

    // Twice, deliberately: the live region announces it and the strip draws it.
    expect(
      await screen.findAllByText('Collection "Spring" deleted'),
    ).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /undo/i })).toBeNull();
  });
});

describe("a visitor", () => {
  it("is told what an account adds, and is promised nothing else", () => {
    setup({ signedIn: false });
    render(<Collections />);

    expect(screen.getByText("Organize your saved courses")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeVisible();
    // There is no comparison feature to promise (#68).
    expect(screen.queryByText(/AI/)).not.toBeInTheDocument();
  });
});

/*
 * The artboard heads this page "Group courses you want to compare." and draws a
 * "New collection" tile promising a side-by-side view. #68's settled decision 1
 * is that neither exists, so the promise is gone from both — a collection is a
 * named, ordered group of saved courses and nothing in the app puts two of them
 * beside each other.
 */
describe("what the page promises", () => {
  it("never offers to compare anything, as a page or as a section", () => {
    setup();
    const page = render(<Collections />);
    expect(page.container.textContent).not.toMatch(/compar/i);
    page.unmount();

    const section = render(<Collections compact />);
    expect(section.container.textContent).not.toMatch(/compar/i);
  });
});

/**
 * #159. The detail pinned every card to `EXPANDED_CARD_GEOMETRY`, which was
 * right on `/collections` and wrong inside `/saved` — the same component sits in
 * the column the workspace pane narrows there, and the surplus was clipped
 * rather than scrolled. The ramp is now the host's to decide.
 */
describe("the geometry an open collection's cards get", () => {
  /** The element `geometryVars` writes the ramp onto: the card's own wrapper. */
  function cardShellFor(courseCode: string): HTMLElement {
    const card = screen
      .getAllByRole("article")
      .find((article) => within(article).queryByText(new RegExp(courseCode)));
    const shell = card?.parentElement;
    if (!shell) throw new Error(`No card rendered for ${courseCode}`);
    return shell;
  }

  it("is the one the host measured, when a host supplies it", () => {
    setup({
      savedCourseCodes: ["AA1000"],
      collections: [{ id: "c1", name: "Spring", courseCodes: ["AA1000"] }],
    });
    render(
      <Collections
        compact
        openCollectionId="c1"
        geo={COLLAPSED_CARD_GEOMETRY}
      />,
    );

    expect(cardShellFor("AA1000").style.getPropertyValue("--card-h")).toBe(
      COLLAPSED_CARD_GEOMETRY.cardHeight,
    );
  });

  /**
   * As a page this measures its own column. jsdom lays nothing out, so
   * `useResultsWidth` keeps its honest `Infinity` — the top of the ramp, which
   * is what a wide column resolves to and what this page used to pin.
   */
  it("is the top of the ramp on an unmeasured column", () => {
    setup({
      savedCourseCodes: ["AA1000"],
      collections: [{ id: "c1", name: "Spring", courseCodes: ["AA1000"] }],
    });
    render(<Collections openCollectionId="c1" />);

    expect(cardShellFor("AA1000").style.getPropertyValue("--card-h")).toBe(
      EXPANDED_CARD_GEOMETRY.cardHeight,
    );
  });
});
