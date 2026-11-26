import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlanItem, TemplateCourse } from "../lib/build-plan";
import type { Period, Slot } from "../lib/slots";
import { CourseTray } from "./course-tray";

vi.mock("@/features/courses", () => ({
  useCourseStats: () => ({ data: {} }),
}));
const search = vi.hoisted(() => ({
  results: [] as { courseCode: string; titleEng: string; credits: number }[],
  /** Whether the hits' facts (and so their periods) have loaded. */
  factsLoaded: false,
}));
vi.mock("../api/queries", () => ({
  useCourseSearch: () => ({ data: { results: search.results } }),
  usePlanFacts: () => ({
    data: search.factsLoaded ? { courses: {}, refs: {} } : undefined,
  }),
  useCurrentRounds: () => ({ data: undefined }),
  useProgramme: () => ({ data: undefined }),
}));

const item = (over: Partial<PlanItem> = {}): PlanItem => ({
  code: "IV1013",
  title: "Introduction to Computer Security",
  credits: 7.5,
  level: "B",
  source: "programme",
  category: "O",
  mandatory: true,
  syllabusYear: 3,
  taken: null,
  slot: null,
  placedByStudent: false,
  segments: [],
  pace: 50,
  roundSource: "programme",
  offeredStarts: [4],
  offPeriod: false,
  status: "planned",
  counts: false,
  startIdx: 20264,
  endIdx: 20264,
  ...over,
});

type Saved = {
  code: string;
  title: string;
  credits: number | null;
  where?: string;
};

const elective = (code: string, name: string): TemplateCourse => ({
  code,
  name,
  credits: 7.5,
  level: "A",
  category: "V",
  track: null,
  note: "",
  studyYear: 4,
  source: "master",
});

function renderTray(
  props: {
    saved?: Saved[];
    leftOut?: PlanItem[];
    electives?: TemplateCourse[];
    where?: Record<string, string>;
    starts?: Record<string, Period[]>;
    target?: Slot;
  } = {},
  tab?: "Saved" | "Search" | "Left out",
) {
  const onShow = vi.fn();
  const onInclude = vi.fn();
  const onAdd = vi.fn();
  const onClearTarget = vi.fn();
  const onRemoveOut = vi.fn();
  render(
    <CourseTray
      unplaced={[]}
      electives={props.electives ?? []}
      saved={props.saved ?? []}
      leftOut={props.leftOut ?? []}
      options={[]}
      onAdd={onAdd}
      onInclude={onInclude}
      onRemoveOut={onRemoveOut}
      onShow={onShow}
      whereOf={(code) => props.where?.[code]}
      titleOf={(_, fallback) => fallback}
      describe={(code) => ({ level: "B", starts: props.starts?.[code] ?? [4] })}
      target={props.target ?? null}
      onClearTarget={onClearTarget}
    />,
  );
  if (tab) fireEvent.click(screen.getByRole("tab", { name: tab }));
  return { onShow, onInclude, onAdd, onClearTarget, onRemoveOut };
}

describe("CourseTray", () => {
  it("keeps a saved course that is already in the plan, and says where it sits", () => {
    const { onShow } = renderTray(
      {
        saved: [
          { code: "SF2930", title: "Regression Analysis", credits: 7.5 },
          {
            code: "IV1013",
            title: "Introduction to Computer Security",
            credits: 7.5,
            where: "VT 2027 P4",
          },
        ],
      },
      "Saved",
    );

    expect(
      screen.queryByText(/Courses you save on Explore/),
    ).not.toBeInTheDocument();
    // The course still to add offers the period grid; the one in the plan doesn't.
    expect(
      screen.getByRole("button", { name: "Add SF2930 to a period" }),
    ).toBeInTheDocument();
    const inPlan = screen.getByText("Already in your plan").parentElement;
    if (!inPlan) throw new Error("no in-plan group");
    expect(within(inPlan).getByText("VT 2027 P4")).toBeInTheDocument();
    expect(
      within(inPlan).queryByRole("button", { name: /to a period/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(inPlan).getByRole("button", { name: "Show in plan" }),
    );
    expect(onShow).toHaveBeenCalledWith("IV1013");
  });

  it("keeps a search hit that is already in the plan, marked, instead of dropping it", () => {
    search.results = [
      {
        courseCode: "IV1013",
        titleEng: "Introduction to Computer Security",
        credits: 7.5,
      },
      { courseCode: "SF2930", titleEng: "Regression Analysis", credits: 7.5 },
    ];
    const { onShow } = renderTray(
      { where: { IV1013: "VT 2027 P4" } },
      "Search",
    );

    expect(screen.getByText("VT 2027 P4")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add SF2930 to a period" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add IV1013 to a period" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show in plan" }));
    expect(onShow).toHaveBeenCalledWith("IV1013");
    search.results = [];
  });

  it("opened from an empty period, lists what is given then and adds straight into it", () => {
    const { onAdd, onClearTarget } = renderTray({
      electives: [
        elective("DD2421", "Machine Learning"),
        elective("DD2424", "Deep Learning in Data Science"),
      ],
      starts: { DD2421: [3], DD2424: [4] },
      target: { ay: 2028, p: 3 },
    });

    expect(screen.getByText("VT 2029 P3")).toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
    // Not given in P3: hidden until asked for.
    expect(
      screen.queryByText("Deep Learning in Data Science"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add to P3" }));
    expect(onAdd).toHaveBeenCalledWith("DD2421", { ay: 2028, p: 3 });
    expect(onClearTarget).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Show 1 not given in P3" }),
    );
    expect(
      screen.getByText("Deep Learning in Data Science"),
    ).toBeInTheDocument();
  });

  it("says nothing is saved only when nothing is", () => {
    renderTray({}, "Saved");
    expect(screen.getByText(/Courses you save on Explore/)).toBeInTheDocument();
    expect(screen.queryByText("Already in your plan")).not.toBeInTheDocument();
  });

  it("draws a left-out course as the same card, with Include again", () => {
    const { onInclude } = renderTray({ leftOut: [item()] }, "Left out");

    expect(screen.getByText("Mandatory")).toBeInTheDocument();
    expect(screen.getByText("7,5 hp")).toBeInTheDocument();
    expect(screen.getByText("Given in P4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Details/ })).toHaveAttribute(
      "href",
      "/search?open=IV1013",
    );

    fireEvent.click(screen.getByRole("button", { name: "Include again" }));
    expect(onInclude).toHaveBeenCalledWith("IV1013");
  });

  it("lets a left-out elective leave the plan for good, but not a mandatory course", () => {
    const { onRemoveOut } = renderTray(
      {
        leftOut: [
          item(),
          item({ code: "DD2352", mandatory: false, category: "VV" }),
        ],
      },
      "Left out",
    );
    expect(
      screen.queryByRole("button", { name: "Remove IV1013 from the plan" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove DD2352 from the plan" }),
    );
    expect(onRemoveOut).toHaveBeenCalledWith("DD2352");
  });

  it("keeps search to the period chosen on the grid, once the hits' periods are known", () => {
    search.results = [
      { courseCode: "SF2930", titleEng: "Regression Analysis", credits: 7.5 },
      { courseCode: "SF2701", titleEng: "Financial Mathematics", credits: 7.5 },
    ];
    const props = {
      starts: { SF2930: [3 as const], SF2701: [1 as const] },
      target: { ay: 2027, p: 3 as const },
    };
    // Before the hits' rounds are in, every hit shows.
    renderTray(props, "Search");
    expect(screen.getByText("Financial Mathematics")).toBeInTheDocument();
    cleanup();

    search.factsLoaded = true;
    renderTray(props, "Search");
    expect(screen.getByText("Regression Analysis")).toBeInTheDocument();
    expect(screen.queryByText("Financial Mathematics")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Show 1 not given in P3" }),
    );
    expect(screen.getByText("Financial Mathematics")).toBeInTheDocument();
    search.factsLoaded = false;
    search.results = [];
  });
});
