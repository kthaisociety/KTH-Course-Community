import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnreviewedTakenCourse } from "@/features/reviews/api/queries";
import type { TranscriptProposal } from "@/server/ingest/transcript/service";
import {
  GUEST_PROPOSAL_TTL_MS,
  readGuestProposal,
  writeGuestProposal,
} from "../lib/guest-proposal";
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
    () => {
      courses: UnreviewedTakenCourse[];
      isLoading: boolean;
      isUnavailable: boolean;
    }
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
/** The round the page hands the reviewer, so a test can see what it pruned. */
const restoredProp = vi.fn();
/** The session this render sees. Guests are a state of this page now. */
const me = vi.fn<() => { isLoading: boolean; isAuthenticated: boolean }>();
/** Which reason the page last asked for an account with, or nothing. */
const authReasonProp = vi.fn();

// One object, as Next's own `useRouter` returns: a fresh one every call would
// make every effect that depends on the router run on every render, which is
// not a thing this screen should have to be robust against in order to be
// tested honestly.
const router = { replace: routerReplace, push: routerPush };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/features/auth", () => ({
  useMe: () => me(),
  // Faithful rather than a no-op: the redirect is the thing these tests are
  // about, so a stub that could not perform it would let the gate come back
  // without a single test noticing.
  useRequireSession: () => {
    if (!me().isAuthenticated) routerReplace("/auth");
    return {};
  },
  AuthReasonDialog: ({ reason }: { reason: string | null }) => {
    authReasonProp(reason);
    return reason === null ? null : (
      <div data-testid="auth-prompt">Asking for an account: {reason}</div>
    );
  },
}));
vi.mock("@/features/courses", () => ({
  // `enabled` is honoured, because `taken.list` is a protected procedure and a
  // signed-out reader genuinely has no list — a mock that answered anyway
  // would hide the whole guest screen behind somebody else's courses.
  useTakenCourses: (enabled: boolean) => ({
    data: enabled ? takenList() : undefined,
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
    restored,
    onClose,
  }: {
    queue: Array<{ courseCode: string }>;
    restored: unknown;
    onClose: () => void;
  }) => {
    restoredProp(restored);
    return (
      <div data-testid="reviewer">
        Reviewing {queue.map((course) => course.courseCode).join(", ")}
        <button type="button" onClick={onClose}>
          Close reviewer
        </button>
      </div>
    );
  },
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

/**
 * One unreviewed course as the hook now hands it over: the taken row plus the
 * catalogue title. The lookup moved into `useUnreviewedTakenCourses` so neither
 * host has to remember it, and My Page was the host that forgot (#157).
 */
function unreviewedCourse(
  overrides: Partial<TakenCourse> = {},
): UnreviewedTakenCourse {
  const course = takenCourse(overrides);
  return { ...course, name: CATALOGUE[course.courseCode]?.titleEng ?? null };
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

/**
 * The token the page minted for whatever is in storage now.
 *
 * Read off the raw record because the page mints it internally and hands it to
 * the sign-in rather than to us — which is the whole point of it.
 */
function storedHandoff(): string | null {
  const raw = localStorage.getItem("kth-cc:taken-proposal");
  return raw === null ? null : JSON.parse(raw).handoff;
}

/**
 * A proposal left for a sign-in, arrived at the way a real sign-in comes back:
 * on `/taken` carrying the record's handoff token. Nothing else reopens it.
 */
function arriveFromSignIn(includeGrades = false): string {
  const handoff = writeGuestProposal(proposal(), includeGrades);
  window.history.replaceState({}, "", `/taken?resume=${handoff}`);
  return handoff ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  // `?review=1` and an interrupted round are both read off the browser, so
  // each test starts on a clean URL and an empty tab store. `localStorage`
  // goes too: a transcript left for a sign-in is kept there.
  window.history.replaceState({}, "", "/taken");
  sessionStorage.clear();
  localStorage.clear();
  // One test moves the clock past a stored proposal's expiry; leaving it moved
  // would silently expire the next test's, so the reset is here rather than at
  // the end of that test, where a failure would skip it.
  vi.useRealTimers();
  me.mockReturnValue({ isLoading: false, isAuthenticated: true });
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
      courses: [unreviewedCourse()],
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

/**
 * Everything on a taken row is self-reported — `CONTEXT.md` says so — and a
 * transcript re-read is the only cheap way back, so the mutation waits behind a
 * confirmation (#155). The artboard confirms after; the product owner settled
 * on before for every destructive action.
 */
describe("removing", () => {
  const askToRemove = (code = "DD1337") =>
    userEvent.click(
      screen.getByLabelText(`Remove ${code} from your taken courses`),
    );
  const confirmRemove = () =>
    userEvent.click(screen.getByRole("button", { name: "Remove course" }));

  it("asks before it removes anything", async () => {
    render(<TakenCourses />);

    await askToRemove();

    expect(
      screen.getByText("Remove DD1337 from your courses?"),
    ).toBeInTheDocument();
    expect(removeTaken).not.toHaveBeenCalled();
  });

  it("keeps the course when the reader backs out", async () => {
    render(<TakenCourses />);

    await askToRemove();
    await userEvent.click(screen.getByRole("button", { name: "Keep course" }));

    expect(
      screen.queryByText("Remove DD1337 from your courses?"),
    ).not.toBeInTheDocument();
    expect(removeTaken).not.toHaveBeenCalled();
  });

  /**
   * The row came from a transcript, so the note that follows offers no Undo —
   * the dialog is where that has to be said, before the click rather than by
   * the reader noticing an absent button afterwards.
   */
  it("says an imported row cannot be put back in a tap", async () => {
    takenList.mockReturnValue([
      takenCourse({ transcriptImportedAt: "2026-08-24T09:00:00.000Z" }),
    ]);
    render(<TakenCourses />);

    await askToRemove();

    expect(screen.getByText(/read from a transcript/i)).toBeInTheDocument();
  });

  it("removes the course and nothing else", async () => {
    render(<TakenCourses />);

    await askToRemove();
    await confirmRemove();

    expect(removeTaken).toHaveBeenCalledWith({ courseCode: "DD1337" });
    expect(updateTaken).not.toHaveBeenCalled();
  });

  it("puts a hand-entered row back exactly as it was, periods included", async () => {
    render(<TakenCourses />);
    await askToRemove();
    await confirmRemove();

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
    await askToRemove();
    await confirmRemove();

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
      courses: [unreviewedCourse(), unreviewedCourse({ courseCode: "DD2380" })],
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

  /** What the mocked reviewer was handed, as the page pruned it. */
  function restoredSession() {
    const raw = restoredProp.mock.calls.at(-1)?.[0];
    return raw ?? null;
  }

  function both() {
    takenList.mockReturnValue([
      takenCourse(),
      takenCourse({ courseCode: "DD2380" }),
    ]);
    unreviewed.mockReturnValue({
      courses: [unreviewedCourse(), unreviewedCourse({ courseCode: "DD2380" })],
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
      courses: [unreviewedCourse()],
      isLoading: false,
      isUnavailable: false,
    });
    storeRound(["DD2380", "DD1337"]);
    render(<TakenCourses />);

    expect(await screen.findByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD1337",
    );
  });

  /**
   * A skip is a fact about a moment that has passed. If the course was
   * reviewed elsewhere afterwards, keeping the skip would have the done screen
   * call it "still marked unreviewed in your list" when it is not, and offer
   * it again under "Go through the skipped ones".
   */
  it("drops a course it skipped that was reviewed elsewhere since", async () => {
    takenList.mockReturnValue([
      takenCourse(),
      takenCourse({ courseCode: "DD2380" }),
    ]);
    unreviewed.mockReturnValue({
      courses: [unreviewedCourse()],
      isLoading: false,
      isUnavailable: false,
    });
    storeRound(["DD2380", "DD1337"], { DD2380: "skipped" });
    render(<TakenCourses />);

    expect(await screen.findByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD1337",
    );
  });

  /** A card this round already saved stays: it is the progress row. */
  it("keeps the cards the round has already answered", async () => {
    both();
    storeRound(["DD1337", "DD2380"], { DD1337: "saved" });
    unreviewed.mockReturnValue({
      courses: [unreviewedCourse({ courseCode: "DD2380" })],
      isLoading: false,
      isUnavailable: false,
    });
    render(<TakenCourses />);

    expect(await screen.findByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD1337, DD2380",
    );
  });

  /**
   * The queue is pruned, so what the round remembers about courses that did
   * not survive the prune must go with them — otherwise the reviewer is handed
   * outcomes for cards it is not dealing.
   */
  it("leaves behind what it remembered about a course it dropped", async () => {
    takenList.mockReturnValue([
      takenCourse(),
      takenCourse({ courseCode: "DD2380" }),
    ]);
    unreviewed.mockReturnValue({
      courses: [unreviewedCourse()],
      isLoading: false,
      isUnavailable: false,
    });
    sessionStorage.setItem(
      "cc.taken.reviewer",
      JSON.stringify({
        queue: ["DD2380", "DD1337"],
        done: { DD2380: "skipped" },
        drafts: {
          DD2380: { methods: [], shares: [], workloadScore: 9 },
          DD1337: { methods: [], shares: [], workloadScore: 4 },
        },
      }),
    );
    render(<TakenCourses />);

    await screen.findByTestId("reviewer");
    expect(restoredSession()).toEqual({
      queue: ["DD1337"],
      done: {},
      drafts: { DD1337: expect.objectContaining({ workloadScore: 4 }) },
    });
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

describe("arriving with ?review=…", () => {
  const both = () =>
    unreviewed.mockReturnValue({
      courses: [unreviewedCourse(), unreviewedCourse({ courseCode: "DD2380" })],
      isLoading: false,
      isUnavailable: false,
    });

  it("opens the reviewer and takes the parameter back out of the URL", async () => {
    window.history.replaceState({}, "", "/taken?review=1");
    unreviewed.mockReturnValue({
      courses: [unreviewedCourse()],
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

  /**
   * The defect this contract was widened for (#157): a row on My Page's prompt
   * names a course, and the round has to start on it rather than on whatever
   * the unreviewed set happens to list first.
   */
  it("starts on the course the link names, with the rest dealt behind it", async () => {
    both();
    window.history.replaceState({}, "", "/taken?review=DD2380");
    render(<TakenCourses />);

    await waitFor(() =>
      expect(screen.getByTestId("reviewer")).toHaveTextContent(
        "Reviewing DD2380, DD1337",
      ),
    );
    expect(routerReplace).toHaveBeenCalledWith("/taken");
  });

  /** Reviewed elsewhere since, or never taken: there is no card to deal for it. */
  it("deals the rest when the named course is no longer unreviewed", async () => {
    unreviewed.mockReturnValue({
      courses: [unreviewedCourse()],
      isLoading: false,
      isUnavailable: false,
    });
    window.history.replaceState({}, "", "/taken?review=SF1625");
    render(<TakenCourses />);

    await waitFor(() =>
      expect(screen.getByTestId("reviewer")).toHaveTextContent(
        "Reviewing DD1337",
      ),
    );
  });

  /**
   * The parameter is a moment, not a value. It is read once, replaced out of
   * the URL, and never read again — so a second pass over the arrival effect,
   * which is exactly what Strict Mode's mount replay is, must not open a second
   * round or replace a second time.
   */
  it("reads the arrival once under Strict Mode's mount replay", async () => {
    both();
    window.history.replaceState({}, "", "/taken?review=DD2380");
    render(
      <StrictMode>
        <TakenCourses />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("reviewer")).toHaveTextContent(
        "Reviewing DD2380, DD1337",
      ),
    );
    expect(routerReplace).toHaveBeenCalledTimes(1);
  });
});
/**
 * The signed-out flow the artboard draws, and the two halves that make it safe.
 *
 * `docs/design_ref/2026-09-06/Course Community - Taken Courses.dc.html:767`
 * poses a guest on the **empty** screen rather than on a locked page, and
 * `:1305-1308` puts the account at the *keep* step: the confirm reads "Sign in
 * to keep this list", and the confirm is resumed once they are in. Everything
 * up to that button is a read — `POST /api/user/transcript` stores nothing —
 * and everything past it is `transcript.confirm`, which is a
 * `protectedProcedure` and is not called here.
 */
describe("a signed-out visitor", () => {
  beforeEach(() => {
    me.mockReturnValue({ isLoading: false, isAuthenticated: false });
    takenList.mockReturnValue([]);
  });

  it("is not sent to /auth", () => {
    render(<TakenCourses />);

    expect(routerReplace).not.toHaveBeenCalledWith("/auth");
  });

  it("lands on the drop zone, which is the artboard's empty screen", () => {
    render(<TakenCourses />);

    expect(screen.getByLabelText("Ladok transcript PDF")).toBeInTheDocument();
  });

  it("reads a transcript and is offered the rows, with nothing written", async () => {
    render(<TakenCourses />);
    await uploadPdf();

    expect(await screen.findByText("1 course read")).toBeInTheDocument();
    expect(uploadTranscript).toHaveBeenCalledTimes(1);
    expect(confirmImport).not.toHaveBeenCalled();
  });

  it("asks for the account at the keep step rather than writing", async () => {
    render(<TakenCourses />);
    await uploadPdf();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Sign in to keep this list",
      }),
    );

    expect(await screen.findByTestId("auth-prompt")).toHaveTextContent(
      "keep-course-list",
    );
    expect(confirmImport).not.toHaveBeenCalled();
  });

  it("holds the rows for the sign-in, and keeps grades out of the record", async () => {
    render(<TakenCourses />);
    await uploadPdf();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Sign in to keep this list",
      }),
    );

    const held = readGuestProposal(storedHandoff());
    expect(held?.proposal.candidates).toEqual([
      expect.objectContaining({ courseCode: "DD1337", grade: null }),
    ]);
  });

  it("keeps the grades when the reader turned the switch on", async () => {
    render(<TakenCourses />);
    await userEvent.click(screen.getByRole("switch", { name: /grade/i }));
    await uploadPdf();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Sign in to keep this list",
      }),
    );

    expect(
      readGuestProposal(storedHandoff())?.proposal.candidates[0].grade,
    ).toBe("B");
  });

  it("asks for an account instead of opening the by-hand form", async () => {
    render(<TakenCourses />);
    await userEvent.click(
      screen.getByRole("button", { name: /Add courses manually/i }),
    );

    expect(await screen.findByTestId("auth-prompt")).toHaveTextContent(
      "sign-up",
    );
    expect(addTaken).not.toHaveBeenCalled();
  });
});

/**
 * Coming back with an account, which is the artboard's `pending: "confirm"`.
 *
 * It stops one step short of the artboard, which writes the moment the account
 * appears: the rows are put back on the preview and the reader presses the
 * button. `use-guest-saves.ts` settled the same question the same way — signing
 * in is not consent to write a list of courses to an account — and here the
 * record it would write from is `localStorage`, which anything on this origin
 * can put rows into.
 */
describe("coming back from a sign-in", () => {
  beforeEach(() => takenList.mockReturnValue([]));

  it("puts the transcript back on the preview", async () => {
    arriveFromSignIn();
    render(<TakenCourses />);

    expect(await screen.findByText("1 course read")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Looks right" }),
    ).toBeInTheDocument();
    expect(confirmImport).not.toHaveBeenCalled();
  });

  it("writes only once the reader confirms, and then forgets the record", async () => {
    const handoff = arriveFromSignIn();
    render(<TakenCourses />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Looks right" }),
    );

    await waitFor(() => expect(confirmImport).toHaveBeenCalledTimes(1));
    expect(readGuestProposal(handoff)).toBeNull();
  });

  /**
   * A spent capability has no business staying in the address bar, in history,
   * or in a URL the reader pastes to somebody. Taken back out the same way
   * `?review=` is.
   */
  it("takes the token back out of the URL", async () => {
    arriveFromSignIn();
    render(<TakenCourses />);

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/taken"));
  });

  it("drops a record that has gone stale rather than reviving it", async () => {
    arriveFromSignIn();
    vi.setSystemTime(Date.now() + GUEST_PROPOSAL_TTL_MS + 1000);
    render(<TakenCourses />);

    expect(
      await screen.findByLabelText("Ladok transcript PDF"),
    ).toBeInTheDocument();
    expect(screen.queryByText("1 course read")).not.toBeInTheDocument();
  });
});

/**
 * The shared browser, which is what the handoff token is for.
 *
 * Guest A reads a transcript on a library machine and never finishes signing
 * in. Their record sits in `localStorage` for up to half an hour. Everything
 * below is somebody *else* arriving at that browser inside the window, and none
 * of them may be shown A's courses — the record is claimable only by an arrival
 * carrying its token, which only A's own sign-in was given.
 *
 * Greptile reported the signed-in case as a P1 on #200 and reproduced it. It
 * was real: the pickup keyed on nothing but "is there a session", so B saw A's
 * rows with "Looks right" under them. The untokened *signed-out* read had to go
 * with it, and that is the subtler half — B being shown the rows while signed
 * out could press "Sign in to keep this list", which mints a fresh token bound
 * to B's own sign-in over A's data, and lands right back at the same place.
 */
describe("a transcript left behind on a shared browser", () => {
  beforeEach(() => takenList.mockReturnValue([]));

  /** Guest A's record, with no token given to whoever arrives next. */
  function leftByGuestA(includeGrades = true) {
    writeGuestProposal(proposal(), includeGrades);
    window.history.replaceState({}, "", "/taken");
  }

  it("is not shown to a different account signing in on the same browser", async () => {
    leftByGuestA();
    me.mockReturnValue({ isLoading: false, isAuthenticated: true });
    render(<TakenCourses />);

    expect(
      await screen.findByLabelText("Ladok transcript PDF"),
    ).toBeInTheDocument();
    expect(screen.queryByText("1 course read")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Looks right" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the grades off that account's screen too", async () => {
    leftByGuestA(true);
    me.mockReturnValue({ isLoading: false, isAuthenticated: true });
    render(<TakenCourses />);

    await screen.findByLabelText("Ladok transcript PDF");
    expect(screen.queryByText("B")).not.toBeInTheDocument();
  });

  /** Refused, not consumed: A's own sign-in can still come back for it. */
  it("leaves the record for the sign-in it was written for", async () => {
    leftByGuestA();
    const handoff = storedHandoff();
    me.mockReturnValue({ isLoading: false, isAuthenticated: true });
    render(<TakenCourses />);

    await screen.findByLabelText("Ladok transcript PDF");
    expect(readGuestProposal(handoff)).not.toBeNull();
  });

  it("is not shown to the next signed-out visitor either", async () => {
    leftByGuestA();
    me.mockReturnValue({ isLoading: false, isAuthenticated: false });
    render(<TakenCourses />);

    expect(
      await screen.findByLabelText("Ladok transcript PDF"),
    ).toBeInTheDocument();
    expect(screen.queryByText("1 course read")).not.toBeInTheDocument();
  });

  /**
   * The token is a capability, so a guessed one is worth no more than none.
   */
  it("is not shown to an arrival carrying the wrong token", async () => {
    leftByGuestA();
    window.history.replaceState({}, "", "/taken?resume=not-the-token");
    me.mockReturnValue({ isLoading: false, isAuthenticated: true });
    render(<TakenCourses />);

    expect(
      await screen.findByLabelText("Ladok transcript PDF"),
    ).toBeInTheDocument();
    expect(screen.queryByText("1 course read")).not.toBeInTheDocument();
  });

  /** Nothing above may cost A their own resume. */
  it("still comes back for the sign-in that left it", async () => {
    arriveFromSignIn();
    me.mockReturnValue({ isLoading: false, isAuthenticated: true });
    render(<TakenCourses />);

    expect(await screen.findByText("1 course read")).toBeInTheDocument();
  });
});
