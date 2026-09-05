import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptProposal } from "@/server/ingest/transcript/service";
import type { TakenCourse } from "../lib/taken-rows";
import { TakenCourses } from "./taken-courses";

const takenList = vi.fn<() => TakenCourse[]>();
const listFailed = vi.fn<() => boolean>();
const refetchTaken =
  vi.fn<
    () => Promise<{ data?: TakenCourse[] | undefined; isError?: boolean }>
  >();
const unreviewed =
  vi.fn<
    () => { courses: TakenCourse[]; isLoading: boolean; isUnavailable: boolean }
  >();
const searchResults =
  vi.fn<
    () => Array<{ courseCode: string; titleEng: string; credits: number }>
  >();
const addTaken = vi.fn();
const updateTaken = vi.fn();
const removeTaken = vi.fn();
const confirmImport = vi.fn();
const uploadTranscript = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const routerReplace = vi.fn();
const routerPush = vi.fn();

// One object, as Next's own `useRouter` returns: a fresh one every call would
// make every effect that depends on the router run on every render, which is
// not a thing this screen should have to be robust against in order to be
// tested honestly.
const router = { replace: routerReplace, push: routerPush };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/features/auth", () => ({
  useMe: () => ({ isLoading: false, isAuthenticated: true }),
  useRequireSession: () => ({}),
}));
vi.mock("@/features/courses", () => ({
  useTakenCourses: () => ({
    data: takenList(),
    isPending: false,
    isError: listFailed(),
    // The screen re-reads the list before it plans an import, so the mock has
    // to answer a refetch the way the real query does — including on failure,
    // where TanStack keeps the last good `data` and raises `isError`.
    refetch: () => refetchTaken(),
  }),
  useCourseSummaries: (codes: string[]) =>
    codes.map((courseCode) => ({ data: CATALOGUE[courseCode] })),
}));
vi.mock("@/features/reviews/api/queries", () => ({
  useUnreviewedTakenCourses: () => unreviewed(),
}));
// The review dialog is not on this screen any more, but the reviews barrel
// still exports it — and with it the rich-text editor and its stylesheet,
// which jsdom has no business loading for a test about a course list.
vi.mock("@/features/reviews/components/review", () => ({
  Review: () => null,
  toEditableReview: (review: unknown) => review,
}));
// Stubbed so the real `UnreviewedCard` still renders: these tests are about
// which courses the page queues, not about the card stack's own form, which
// has its own suite next to it.
vi.mock("@/features/reviews/components/reviewer", () => ({
  Reviewer: ({
    queue,
    onClose,
  }: {
    queue: Array<{ courseCode: string }>;
    onClose: () => void;
  }) => (
    <div data-testid="reviewer">
      Reviewing {queue.map((course) => course.courseCode).join(", ")}
      <button type="button" onClick={onClose}>
        Close reviewer
      </button>
    </div>
  ),
}));
vi.mock("@/features/search", () => ({
  useDebouncedQuery: (value: string) => [value, vi.fn()] as const,
  useSearchCourses: ({ q }: { q: string }) => ({
    data: q.trim() ? { results: searchResults() } : undefined,
    isPending: false,
  }),
}));
vi.mock("../api/mutations", () => ({
  useTakenMutations: () => ({
    add: { mutateAsync: addTaken, isPending: false },
    update: { mutateAsync: updateTaken, isPending: false },
    remove: { mutateAsync: removeTaken, isPending: false },
    confirmImport: { mutateAsync: confirmImport, isPending: false },
  }),
}));
vi.mock("../api/transcript", () => ({
  MAX_TRANSCRIPT_LABEL: "4 MB",
  uploadTranscript: (file: File) => uploadTranscript(file),
}));
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

const CATALOGUE: Record<
  string,
  { courseCode: string; titleEng: string; credits: number }
> = {
  DD1337: { courseCode: "DD1337", titleEng: "Programming", credits: 7.5 },
  DD2380: {
    courseCode: "DD2380",
    titleEng: "Artificial Intelligence",
    credits: 6,
  },
};

function takenCourse(overrides: Partial<TakenCourse> = {}): TakenCourse {
  return {
    courseCode: "DD1337",
    grade: "B",
    earnedCredits: 7.5,
    attendancePeriods: "P1, P2",
    attendanceYear: 2025,
    transcriptImportedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function proposal(
  overrides: Partial<TranscriptProposal> = {},
): TranscriptProposal {
  return {
    candidates: [
      {
        courseCode: "DD1337",
        transcriptName: "Programmering",
        catalogueName: "Programming",
        grade: "B",
        earnedCredits: 7.5,
        attendanceYear: 2025,
      },
    ],
    unmatched: [],
    ...overrides,
  };
}

const PDF = () =>
  new File(["%PDF-1.4"], "resultatintyg.pdf", { type: "application/pdf" });

async function uploadPdf() {
  await userEvent.upload(screen.getByLabelText("Ladok transcript PDF"), PDF());
}

beforeEach(() => {
  vi.clearAllMocks();
  // `?review=1` and an interrupted round are both read off the browser, so
  // each test starts on a clean URL and an empty tab store.
  window.history.replaceState({}, "", "/taken");
  sessionStorage.clear();
  takenList.mockReturnValue([takenCourse()]);
  listFailed.mockReturnValue(false);
  refetchTaken.mockImplementation(() =>
    Promise.resolve({ data: takenList(), isError: false }),
  );
  unreviewed.mockReturnValue({
    courses: [],
    isLoading: false,
    isUnavailable: false,
  });
  searchResults.mockReturnValue([CATALOGUE.DD2380]);
  addTaken.mockResolvedValue({ courseCode: "DD2380", created: true });
  updateTaken.mockResolvedValue({ courseCode: "DD1337" });
  removeTaken.mockResolvedValue({ courseCode: "DD1337" });
  confirmImport.mockResolvedValue({ inserted: 1, updated: 0 });
  uploadTranscript.mockResolvedValue(proposal());
});

describe("the list", () => {
  it("names a taken course from the catalogue and shows what the student reported", () => {
    render(<TakenCourses />);

    expect(screen.getByText("Programming")).toBeInTheDocument();
    expect(screen.getByText("7.5 hp")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
  });

  it("falls back to the course code, because a taken row stores no title", () => {
    takenList.mockReturnValue([takenCourse({ courseCode: "SF1625" })]);
    render(<TakenCourses />);

    expect(screen.getAllByText("SF1625").length).toBeGreaterThan(0);
  });

  it("says a course is not reviewed only once the review lists have arrived", () => {
    unreviewed.mockReturnValue({
      courses: [takenCourse()],
      isLoading: false,
      isUnavailable: false,
    });
    render(<TakenCourses />);

    expect(screen.getByText("Not yet")).toBeInTheDocument();
  });

  it("claims nothing about a review it could not load", () => {
    unreviewed.mockReturnValue({
      courses: [],
      isLoading: false,
      isUnavailable: true,
    });
    render(<TakenCourses />);

    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(screen.queryByText("Not yet")).not.toBeInTheDocument();
  });

  it("does not mistake a failed read for an empty list", () => {
    // A failed query holds no rows, and the screen for no rows is the
    // first-run one: it would tell a reader who has taken twenty courses that
    // they have taken none, and offer to import a transcript over a list this
    // page cannot see.
    listFailed.mockReturnValue(true);
    takenList.mockReturnValue([]);
    render(<TakenCourses />);

    expect(screen.getByText("Your taken courses did not load")).toBeVisible();
    expect(
      screen.queryByText("Drop your Ladok transcript here"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Update transcript" }),
    ).not.toBeInTheDocument();
  });

  it("counts no courses off a read that failed", () => {
    // A failed query can still be holding what an earlier one returned. A
    // count beside "did not load" would outlive the read it came from.
    listFailed.mockReturnValue(true);
    takenList.mockReturnValue([
      takenCourse(),
      takenCourse({ courseCode: "DD2380" }),
    ]);
    render(<TakenCourses />);

    expect(screen.getByText("Your taken courses did not load")).toBeVisible();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    expect(screen.queryByText("DD1337")).not.toBeInTheDocument();
  });

  it("offers the read again", async () => {
    listFailed.mockReturnValue(true);
    render(<TakenCourses />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(refetchTaken).toHaveBeenCalled();
  });
});

describe("manual and imported rows", () => {
  it("marks a row a transcript filled in, and dates the read", () => {
    takenList.mockReturnValue([
      takenCourse({ transcriptImportedAt: "2026-08-24T09:00:00.000Z" }),
    ]);
    render(<TakenCourses />);

    expect(screen.getByText("Imported")).toBeInTheDocument();
    expect(screen.getByText("Last read 24 Aug 2026")).toBeInTheDocument();
  });

  it("leaves a hand-entered row unmarked and says so", () => {
    render(<TakenCourses />);

    expect(screen.queryByText("Imported")).not.toBeInTheDocument();
    expect(screen.getByText("Added by hand")).toBeInTheDocument();
  });
});

describe("editing in place", () => {
  it("carries the stored attendance periods through a grade correction", async () => {
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByLabelText("Edit credits, grade and year for DD1337"),
    );
    const grade = screen.getByLabelText("Grade for DD1337");
    await userEvent.clear(grade);
    await userEvent.type(grade, "A");
    await userEvent.click(screen.getByLabelText("Save DD1337"));

    expect(updateTaken).toHaveBeenCalledWith({
      courseCode: "DD1337",
      grade: "A",
      earnedCredits: 7.5,
      attendanceYear: 2025,
      attendancePeriods: "P1, P2",
    });
  });

  it("keeps the editor open holding the draft when the write is refused", async () => {
    updateTaken.mockRejectedValue(new Error("nope"));
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByLabelText("Edit credits, grade and year for DD1337"),
    );
    const grade = screen.getByLabelText("Grade for DD1337");
    await userEvent.clear(grade);
    await userEvent.type(grade, "A");
    await userEvent.click(screen.getByLabelText("Save DD1337"));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByLabelText("Grade for DD1337")).toHaveValue("A");
  });

  it("refuses to send a year that is not one", async () => {
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByLabelText("Edit credits, grade and year for DD1337"),
    );
    const year = screen.getByLabelText("Year for DD1337");
    await userEvent.clear(year);
    await userEvent.type(year, "20");

    expect(screen.getByLabelText("Save DD1337")).toBeDisabled();
    expect(updateTaken).not.toHaveBeenCalled();
  });
});

describe("adding by hand", () => {
  it("records a course the reader picked out of the catalogue", async () => {
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add a course by hand" }),
    );
    await userEvent.type(
      screen.getByLabelText("Search the KTH catalogue"),
      "DD2380",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /DD2380\s*Artificial Intelligence/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add course" }));

    expect(addTaken).toHaveBeenCalledWith({
      courseCode: "DD2380",
      grade: null,
      earnedCredits: 6,
      attendanceYear: null,
    });
  });

  it("keeps the draft when the write is refused", async () => {
    addTaken.mockRejectedValue(new Error("nope"));
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add a course by hand" }),
    );
    await userEvent.type(
      screen.getByLabelText("Search the KTH catalogue"),
      "DD2380",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /DD2380\s*Artificial Intelligence/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add course" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // The dialog is still open, still holding the course the reader picked.
    expect(screen.getByRole("button", { name: "Add course" })).toBeEnabled();
    expect(screen.getAllByText("DD2380").length).toBeGreaterThan(0);
  });

  it("cannot be dismissed out from under a write still in flight", async () => {
    // Cancelling clears the draft, and a request that later rejects has
    // nothing to hand back — the reader would retype everything to retry.
    let reject = (_: Error) => {};
    addTaken.mockImplementation(
      () =>
        new Promise((_resolve, rejectAdd) => {
          reject = rejectAdd;
        }),
    );
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add a course by hand" }),
    );
    await userEvent.type(
      screen.getByLabelText("Search the KTH catalogue"),
      "DD2380",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /DD2380\s*Artificial Intelligence/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add course" }));

    // Every way out is shut while the write is in flight — the × and the
    // footer button both read "Cancel", and Escape comes through the same
    // guard because the parent owns `open`.
    const cancels = screen.getAllByRole("button", { name: "Cancel" });
    expect(cancels).toHaveLength(2);
    for (const cancel of cancels) {
      expect(cancel).toBeDisabled();
      await userEvent.click(cancel);
    }
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Adding…" })).toBeVisible();

    await act(async () => {
      reject(new Error("nope"));
    });
    // Still open, still holding what the reader picked.
    expect(screen.getByRole("button", { name: "Add course" })).toBeEnabled();
    expect(screen.getAllByText("DD2380").length).toBeGreaterThan(0);
  });

  it("cannot offer a course already on the list", async () => {
    searchResults.mockReturnValue([CATALOGUE.DD1337]);
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add a course by hand" }),
    );
    await userEvent.type(
      screen.getByLabelText("Search the KTH catalogue"),
      "DD1337",
    );

    expect(
      screen.getByRole("button", { name: /DD1337\s*Programming/ }),
    ).toBeDisabled();
  });
});

describe("removing", () => {
  it("removes the course and nothing else", async () => {
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByLabelText("Remove DD1337 from your taken courses"),
    );

    expect(removeTaken).toHaveBeenCalledWith({ courseCode: "DD1337" });
    expect(updateTaken).not.toHaveBeenCalled();
  });

  it("puts a hand-entered row back exactly as it was, periods included", async () => {
    render(<TakenCourses />);
    await userEvent.click(
      screen.getByLabelText("Remove DD1337 from your taken courses"),
    );

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    const [, options] = toastSuccess.mock.calls[0];
    options.action.onClick();

    expect(addTaken).toHaveBeenCalledWith({
      courseCode: "DD1337",
      grade: "B",
      earnedCredits: 7.5,
      attendancePeriods: "P1, P2",
      attendanceYear: 2025,
    });
  });

  it("offers no undo for an imported row, which would come back re-labelled", async () => {
    takenList.mockReturnValue([
      takenCourse({ transcriptImportedAt: "2026-08-24T09:00:00.000Z" }),
    ]);
    render(<TakenCourses />);
    await userEvent.click(
      screen.getByLabelText("Remove DD1337 from your taken courses"),
    );

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0][1].action).toBeUndefined();
  });
});

describe("reading a transcript", () => {
  beforeEach(() => takenList.mockReturnValue([]));

  it("turns an upload into a proposal and writes nothing", async () => {
    render(<TakenCourses />);
    await uploadPdf();

    expect(await screen.findByText("1 course read")).toBeInTheDocument();
    expect(uploadTranscript).toHaveBeenCalledTimes(1);
    expect(confirmImport).not.toHaveBeenCalled();
    expect(
      screen.getByText("Nothing is saved to your list until you confirm."),
    ).toBeInTheDocument();
  });

  it("names the course codes the catalogue does not have", async () => {
    uploadTranscript.mockResolvedValue(
      proposal({
        unmatched: [{ courseCode: "XX9999", courseName: "Something else" }],
      }),
    );
    render(<TakenCourses />);
    await uploadPdf();

    expect(
      await screen.findByText("1 row was not a KTH catalogue course"),
    ).toBeInTheDocument();
    expect(screen.getByText("XX9999 — Something else")).toBeInTheDocument();
  });

  it("writes the proposal only when the reader confirms it", async () => {
    render(<TakenCourses />);
    await uploadPdf();
    await userEvent.click(
      await screen.findByRole("button", { name: "Looks right" }),
    );

    await waitFor(() =>
      expect(confirmImport).toHaveBeenCalledWith({
        courses: [
          {
            courseCode: "DD1337",
            grade: null,
            earnedCredits: 7.5,
            attendanceYear: 2025,
          },
        ],
      }),
    );
  });

  it("leaves a course the reader already corrected exactly as they left it", async () => {
    // Not the empty list this block sets up: the reader has DD1337 already,
    // graded A where the transcript says B.
    takenList.mockReturnValue([takenCourse({ grade: "A" })]);
    render(<TakenCourses />);
    await userEvent.click(
      screen.getByRole("button", { name: "Update transcript" }),
    );
    await uploadPdf();
    await userEvent.click(
      await screen.findByRole("button", { name: "Looks right" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Transcript read — nothing new in it"),
      ).toBeInTheDocument(),
    );
    expect(confirmImport).not.toHaveBeenCalled();
    expect(updateTaken).not.toHaveBeenCalled();
  });

  it("plans against the list as it is now, not as it was when the page loaded", async () => {
    render(<TakenCourses />);
    await uploadPdf();
    await screen.findByText("1 course read");
    // Another tab records DD1337 by hand while the proposal sits on screen.
    // Planning against the render's snapshot would unnecessarily try to create
    // it; the confirmation endpoint is also insert-only as a race-safe guard.
    takenList.mockReturnValue([takenCourse()]);
    await userEvent.click(screen.getByRole("button", { name: "Looks right" }));

    await waitFor(() =>
      expect(
        screen.getByText("Transcript read — nothing new in it"),
      ).toBeInTheDocument(),
    );
    expect(confirmImport).not.toHaveBeenCalled();
    expect(updateTaken).not.toHaveBeenCalled();
  });

  it("fills only an empty field, and keeps the periods while doing it", async () => {
    takenList.mockReturnValue([
      takenCourse({ grade: null, earnedCredits: 9, attendancePeriods: "P3" }),
    ]);
    render(<TakenCourses />);
    // The switch lives in the update dialog once the list has courses in it.
    await userEvent.click(
      screen.getByRole("button", { name: "Update transcript" }),
    );
    await userEvent.click(
      screen.getByRole("switch", { name: /Read grades from transcript/ }),
    );
    await uploadPdf();
    await userEvent.click(
      await screen.findByRole("button", { name: "Looks right" }),
    );

    await waitFor(() =>
      expect(confirmImport).toHaveBeenCalledWith({
        courses: [],
        fills: [
          expect.objectContaining({
            courseCode: "DD1337",
            grade: "B",
            earnedCredits: 9,
            attendanceYear: 2025,
          }),
        ],
      }),
    );
    expect(updateTaken).not.toHaveBeenCalled();
  });

  it("keeps the transcript's grades once the reader asks for them", async () => {
    render(<TakenCourses />);
    await userEvent.click(
      screen.getByRole("switch", { name: /Read grades from transcript/ }),
    );
    await uploadPdf();
    await userEvent.click(
      await screen.findByRole("button", { name: "Looks right" }),
    );

    await waitFor(() =>
      expect(confirmImport).toHaveBeenCalledWith({
        courses: [expect.objectContaining({ grade: "B" })],
      }),
    );
  });

  it("discards a proposal without writing it", async () => {
    render(<TakenCourses />);
    await uploadPdf();
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard" }),
    );

    expect(confirmImport).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Drop your Ladok transcript here"),
    ).toBeInTheDocument();
  });

  it("writes nothing and says so when the list cannot be re-read", async () => {
    render(<TakenCourses />);
    await uploadPdf();
    await screen.findByText("1 course read");
    // A failed refetch keeps the last good `data`, which is the very snapshot
    // the re-read exists to distrust. Planning against it would put back the
    // overwrite this re-read was added to prevent.
    refetchTaken.mockResolvedValue({ data: takenList(), isError: true });
    await userEvent.click(screen.getByRole("button", { name: "Looks right" }));

    expect(
      await screen.findByText(/could not re-read your course list/),
    ).toBeInTheDocument();
    expect(confirmImport).not.toHaveBeenCalled();
    expect(updateTaken).not.toHaveBeenCalled();
    // The proposal is still there to confirm again once the read works.
    expect(screen.getByRole("button", { name: "Looks right" })).toBeVisible();
  });

  it("explains a rejected re-read rather than sitting there silently", async () => {
    render(<TakenCourses />);
    await uploadPdf();
    await screen.findByText("1 course read");
    refetchTaken.mockRejectedValue(new Error("The list did not come back."));
    await userEvent.click(screen.getByRole("button", { name: "Looks right" }));

    expect(
      await screen.findByText(/The list did not come back\./),
    ).toBeInTheDocument();
    expect(confirmImport).not.toHaveBeenCalled();
  });

  it("takes one confirm even when the button is pressed twice", async () => {
    // A candidate the list does not have yet, so confirming makes a create.
    uploadTranscript.mockResolvedValue(
      proposal({
        candidates: [
          {
            courseCode: "DD2380",
            transcriptName: "Artificiell intelligens",
            catalogueName: "Artificial Intelligence",
            grade: "A",
            earnedCredits: 6,
            attendanceYear: 2026,
          },
        ],
      }),
    );
    let release = () => {};
    confirmImport.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ inserted: 1, updated: 0 });
        }),
    );
    render(<TakenCourses />);
    await uploadPdf();
    const confirm = await screen.findByRole("button", { name: "Looks right" });
    await userEvent.click(confirm);
    await waitFor(() => expect(confirmImport).toHaveBeenCalledTimes(1));
    // "Saving…" holds for the whole confirm, so a second press does nothing.
    const saving = screen.getByRole("button", { name: "Saving…" });
    expect(saving).toBeDisabled();
    await userEvent.click(saving);

    expect(confirmImport).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
    });
    expect(screen.queryByText("1 course read")).not.toBeInTheDocument();
    expect(confirmImport).toHaveBeenCalledTimes(1);
  });

  it("says an unreadable file was unreadable, and writes nothing", async () => {
    uploadTranscript.mockRejectedValue(
      new Error("No course rows came out of that file."),
    );
    render(<TakenCourses />);
    await uploadPdf();

    expect(
      await screen.findByText("We could not read that transcript"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No course rows came out of that file."),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing was saved")).toBeInTheDocument();
    expect(confirmImport).not.toHaveBeenCalled();
    expect(addTaken).not.toHaveBeenCalled();
  });
});

describe("the fast-track reviewer", () => {
  const bothUnreviewed = () =>
    unreviewed.mockReturnValue({
      courses: [takenCourse(), takenCourse({ courseCode: "DD2380" })],
      isLoading: false,
      isUnavailable: false,
    });

  it("deals every unreviewed course when the fast track is started", async () => {
    bothUnreviewed();
    takenList.mockReturnValue([
      takenCourse(),
      takenCourse({ courseCode: "DD2380" }),
    ]);
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByRole("button", { name: "Fast track all 2" }),
    );

    expect(screen.getByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD1337, DD2380",
    );
    // The reviewer is a screen, not an overlay: the list it replaced is gone.
    expect(
      screen.queryByRole("button", { name: "Add a course by hand" }),
    ).not.toBeInTheDocument();
  });

  /**
   * A row is a starting point, not a queue of one. Someone who came to review
   * one course is exactly who is most likely to review a second, so the rest
   * are dealt behind it — which is what the artboard's `openReviewer(startId)`
   * does.
   */
  it("puts the row the reader picked at the front of the whole queue", async () => {
    bothUnreviewed();
    takenList.mockReturnValue([
      takenCourse(),
      takenCourse({ courseCode: "DD2380" }),
    ]);
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByRole("button", {
        name: /^DD2380\s*Artificial Intelligence$/,
      }),
    );

    expect(screen.getByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD2380, DD1337",
    );
  });

  it("gives the list back when the reviewer is closed", async () => {
    bothUnreviewed();
    render(<TakenCourses />);

    await userEvent.click(
      screen.getByRole("button", { name: "Fast track all 2" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Close reviewer" }),
    );

    expect(screen.queryByTestId("reviewer")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add a course by hand" }),
    ).toBeInTheDocument();
  });
});

/**
 * `sessionStorage` says what this tab was doing, not what is still true. Every
 * one of these is about the gap between the two.
 */
describe("a round a reload interrupted", () => {
  function storeRound(
    queue: string[],
    done: Record<string, "saved" | "skipped"> = {},
  ) {
    sessionStorage.setItem(
      "cc.taken.reviewer",
      JSON.stringify({ queue, done, drafts: {} }),
    );
  }

  function both() {
    takenList.mockReturnValue([
      takenCourse(),
      takenCourse({ courseCode: "DD2380" }),
    ]);
    unreviewed.mockReturnValue({
      courses: [takenCourse(), takenCourse({ courseCode: "DD2380" })],
      isLoading: false,
      isUnavailable: false,
    });
  }

  it("picks the round back up where it stopped", async () => {
    both();
    storeRound(["DD2380", "DD1337"], { DD2380: "skipped" });
    render(<TakenCourses />);

    expect(await screen.findByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD2380, DD1337",
    );
  });

  /**
   * The reader reviewed DD2380 somewhere else — the workspace pane, another
   * tab — while this round was sitting in storage. Dealing its card again
   * would ask for a second review of a course that has one.
   */
  it("drops a course that was reviewed since the round was stored", async () => {
    takenList.mockReturnValue([
      takenCourse(),
      takenCourse({ courseCode: "DD2380" }),
    ]);
    unreviewed.mockReturnValue({
      courses: [takenCourse()],
      isLoading: false,
      isUnavailable: false,
    });
    storeRound(["DD2380", "DD1337"]);
    render(<TakenCourses />);

    expect(await screen.findByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD1337",
    );
  });

  /** A card this round already dealt with stays: it is the progress row. */
  it("keeps the cards the round has already answered", async () => {
    both();
    storeRound(["DD1337", "DD2380"], { DD1337: "saved" });
    unreviewed.mockReturnValue({
      courses: [takenCourse({ courseCode: "DD2380" })],
      isLoading: false,
      isUnavailable: false,
    });
    render(<TakenCourses />);

    expect(await screen.findByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD1337, DD2380",
    );
  });

  it("forgets a round with no cards left to deal", async () => {
    unreviewed.mockReturnValue({
      courses: [],
      isLoading: false,
      isUnavailable: false,
    });
    storeRound(["DD1337"], { DD1337: "saved" });
    render(<TakenCourses />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add a course by hand" }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("reviewer")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("cc.taken.reviewer")).toBeNull();
  });

  /**
   * An unfinished round outranks the deep link, because it holds answers that
   * were typed and never saved and a fresh queue would throw them away.
   */
  it("resumes rather than restarting when ?review=1 arrives too", async () => {
    both();
    window.history.replaceState({}, "", "/taken?review=1");
    storeRound(["DD2380", "DD1337"], { DD2380: "skipped" });
    render(<TakenCourses />);

    expect(await screen.findByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD2380, DD1337",
    );
  });
});

describe("arriving with ?review=1", () => {
  it("opens the reviewer and takes the parameter back out of the URL", async () => {
    window.history.replaceState({}, "", "/taken?review=1");
    unreviewed.mockReturnValue({
      courses: [takenCourse()],
      isLoading: false,
      isUnavailable: false,
    });
    render(<TakenCourses />);

    await waitFor(() =>
      expect(screen.getByTestId("reviewer")).toHaveTextContent(
        "Reviewing DD1337",
      ),
    );
    // Read once, then removed: a reload must not reopen the reviewer over a
    // list the reader deliberately went back to.
    expect(routerReplace).toHaveBeenCalledWith("/taken");
  });

  /**
   * The deep link waits for the unreviewed set rather than guessing at it, and
   * gives up quietly when there is nothing to review — the reader lands on
   * their list, which is the honest answer to "review my courses" when there
   * is nothing left to review.
   */
  it("stays on the list when nothing is unreviewed", async () => {
    window.history.replaceState({}, "", "/taken?review=1");
    render(<TakenCourses />);

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/taken"));
    expect(screen.queryByTestId("reviewer")).not.toBeInTheDocument();
  });
});
