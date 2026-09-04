import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptProposal } from "@/server/ingest/transcript/service";
import type { TakenCourse } from "../lib/taken-rows";
import { TakenCourses } from "./taken-courses";

const takenList = vi.fn<() => TakenCourse[]>();
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

vi.mock("@/features/auth", () => ({
  useMe: () => ({ isLoading: false, isAuthenticated: true }),
  useRequireSession: () => ({}),
}));
vi.mock("@/features/courses", () => ({
  useTakenCourses: () => ({ data: takenList(), isPending: false }),
  useCourseSummaries: (codes: string[]) =>
    codes.map((courseCode) => ({ data: CATALOGUE[courseCode] })),
}));
vi.mock("@/features/reviews/api/queries", () => ({
  useUnreviewedTakenCourses: () => unreviewed(),
}));
// Stubbed so the real `UnreviewedCard` still renders: this test is about which
// course the page hands the review dialog, not about the dialog's own form.
vi.mock("@/features/reviews/components/review", () => ({
  Review: ({ courseCode }: { courseCode: string }) => (
    <div data-testid="reviewer">Reviewing {courseCode}</div>
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
  takenList.mockReturnValue([takenCourse()]);
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

describe("the unreviewed prompt", () => {
  it("opens the reviewer in place rather than leaving the page", async () => {
    unreviewed.mockReturnValue({
      courses: [takenCourse()],
      isLoading: false,
      isUnavailable: false,
    });
    render(<TakenCourses />);

    // The prompt's own row button, which `UnreviewedCard` renders in place of
    // its link once a screen passes `onSelect`. Its accessible name is the
    // course code and title; the table's controls are labelled differently.
    await userEvent.click(
      screen.getByRole("button", { name: /^DD1337\s*Programming$/ }),
    );

    expect(screen.getByTestId("reviewer")).toHaveTextContent(
      "Reviewing DD1337",
    );
  });
});
