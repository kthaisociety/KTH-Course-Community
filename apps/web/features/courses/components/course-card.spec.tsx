import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SAMPLE_COURSE, SAMPLE_GEO } from "@/data/course-card-sample";
import type { CourseCardModel, CourseReviewStats } from "@/types";
import {
  COLLAPSED_CARD_GEOMETRY,
  EXPANDED_CARD_GEOMETRY,
} from "../lib/card-geometry";
import {
  type CourseCardCourse,
  toCourseCardModel,
} from "../lib/course-card-model";
import { CourseCard } from "./course-card";

const COURSE: CourseCardCourse = {
  courseCode: "DD2380",
  titleEng: "Artificial Intelligence",
  credits: 6,
  department: "EECS",
  educationalLevel: "Advanced",
};

const REVIEWS: CourseReviewStats = {
  reviewCount: 148,
  happyCount: 129,
  happyPercent: 87,
  workloadMean: 7.6,
  learningMean: 8.4,
  approachTheoryPercent: null,
  approachTheoryAnswerCount: 0,
  examinationDistribution: null,
  examinationAnswerCount: 90,
  examLabel: "Labs 60% · Exam 40%",
};

function reviewedCard(overrides: Partial<CourseCardModel> = {}) {
  return {
    ...toCourseCardModel({
      course: COURSE,
      stats: { reviews: REVIEWS, takenCount: 1200 },
      isSaved: false,
      isTaken: false,
    }),
    ...overrides,
  };
}

function unreviewedCard(overrides: Partial<CourseCardModel> = {}) {
  return {
    ...toCourseCardModel({
      course: COURSE,
      stats: { reviews: null, takenCount: 0 },
      isSaved: false,
      isTaken: false,
    }),
    ...overrides,
  };
}

describe("CourseCard", () => {
  // The fixture is the artboard's own literal. If the card cannot render it,
  // the prop shape has drifted from the design it was extracted from.
  it("renders the artboard's sample with no reshaping", () => {
    render(<CourseCard c={SAMPLE_COURSE} geo={SAMPLE_GEO} />);

    expect(
      screen.getByRole("heading", { name: "DD2380 Artificial Intelligence" }),
    ).toBeInTheDocument();
    expect(screen.getByText("6.0 credits · EECS · Advanced")).toBeVisible();
    expect(screen.getByText("Labs 60% · Exam 40%")).toBeVisible();
    expect(screen.getByText("87%")).toBeVisible();
  });

  describe("a course nobody has reviewed", () => {
    // `reviews` is empty today, so this is the common case, not an edge one.
    it("says so twice and never renders a zero", () => {
      const { container } = render(
        <CourseCard c={unreviewedCard()} geo={EXPANDED_CARD_GEOMETRY} />,
      );

      expect(screen.getAllByText("No reviews yet")).toHaveLength(2);
      expect(
        screen.getByText("Be the first to say how it went."),
      ).toBeVisible();
      expect(container.textContent).not.toContain("0%");
      expect(screen.queryByText(/reviewers are happy/)).toBeNull();
    });

    it("leaves the score bars empty rather than at zero", () => {
      render(<CourseCard c={unreviewedCard()} geo={EXPANDED_CARD_GEOMETRY} />);
      expect(screen.getAllByText("—")).toHaveLength(2);
    });
  });

  describe("prerequisites", () => {
    it("says nothing at all when none were ever extracted", () => {
      render(<CourseCard c={reviewedCard()} geo={EXPANDED_CARD_GEOMETRY} />);
      expect(screen.getByText("Prerequisites")).toBeVisible();
      expect(screen.queryByText("None listed")).toBeNull();
    });

    it("says 'None listed' only when extraction found none", () => {
      const c = toCourseCardModel({
        course: COURSE,
        stats: { reviews: REVIEWS, takenCount: 3 },
        isSaved: false,
        isTaken: false,
        prerequisites: [],
      });
      render(<CourseCard c={c} geo={EXPANDED_CARD_GEOMETRY} />);
      expect(screen.getByText("None listed")).toBeVisible();
    });
  });

  describe("a visitor", () => {
    it("is offered the sign-in prompt instead of a picker", async () => {
      const onSignUp = vi.fn();
      const onLogIn = vi.fn();
      render(
        <CourseCard
          c={reviewedCard({ pickerOpen: true, onSignUp, onLogIn })}
          geo={EXPANDED_CARD_GEOMETRY}
        />,
      );

      expect(screen.getByText("Organize your saved courses")).toBeVisible();
      expect(screen.queryByText("Create new collection")).toBeNull();

      await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
      expect(onSignUp).toHaveBeenCalledOnce();
      await userEvent.click(screen.getByRole("button", { name: "Log in" }));
      expect(onLogIn).toHaveBeenCalledOnce();
    });

    // The artboard dismisses its panels from the screen, with one handler that
    // can see every card. State is per-card here, so the card does it — which
    // also means pointing at another card's trigger closes this one.
    it("closes the picker when the reader points somewhere else", async () => {
      const onPicker = vi.fn();
      render(
        <CourseCard
          signedIn
          c={reviewedCard({ pickerOpen: true, onPicker })}
          geo={EXPANDED_CARD_GEOMETRY}
        />,
      );

      await userEvent.click(document.body);
      expect(onPicker).toHaveBeenCalledOnce();
    });

    it("does not close the picker on a press inside it", async () => {
      const onPicker = vi.fn();
      const onNewCollection = vi.fn();
      render(
        <CourseCard
          signedIn
          c={reviewedCard({ pickerOpen: true, onPicker, onNewCollection })}
          geo={EXPANDED_CARD_GEOMETRY}
        />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: "Create new collection" }),
      );
      expect(onNewCollection).toHaveBeenCalledOnce();
      expect(onPicker).not.toHaveBeenCalled();
    });

    it("closes the picker on Escape", async () => {
      const onPicker = vi.fn();
      render(
        <CourseCard
          signedIn
          c={reviewedCard({ pickerOpen: true, onPicker })}
          geo={EXPANDED_CARD_GEOMETRY}
        />,
      );

      await userEvent.keyboard("{Escape}");
      expect(onPicker).toHaveBeenCalledOnce();
    });

    // The prompt must not advertise a feature that does not exist (#68).
    it("is not promised an AI comparison", () => {
      const { container } = render(
        <CourseCard
          c={reviewedCard({ pickerOpen: true })}
          geo={EXPANDED_CARD_GEOMETRY}
        />,
      );
      expect(container.textContent).not.toContain("compare courses with AI");
    });

    it("gets the same prompt over the taken pill", () => {
      render(
        <CourseCard
          c={reviewedCard({ takenPickerOpen: true })}
          geo={EXPANDED_CARD_GEOMETRY}
        />,
      );
      expect(screen.getByText("Track courses you've taken")).toBeVisible();
    });
  });

  describe("a signed-in viewer", () => {
    it("gets the picker, its collections and the row that makes one", async () => {
      const onClick = vi.fn();
      const onNewCollection = vi.fn();
      render(
        <CourseCard
          signedIn
          c={reviewedCard({
            pickerOpen: true,
            hasCollections: true,
            onNewCollection,
            collections: [
              { id: "k1", name: "Spring P3", fill: "none", tick: "" },
              {
                id: "k2",
                name: "Maybe",
                fill: "currentColor",
                tick: "m8.5 12 2.4 2.4 4.6-4.9",
                onClick,
              },
            ],
          })}
          geo={EXPANDED_CARD_GEOMETRY}
        />,
      );

      expect(screen.queryByText("Organize your saved courses")).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Maybe" }));
      expect(onClick).toHaveBeenCalledOnce();

      await userEvent.click(
        screen.getByRole("button", { name: "Create new collection" }),
      );
      expect(onNewCollection).toHaveBeenCalledOnce();
    });

    it("commits a new collection name on Enter and abandons it on Escape", async () => {
      const onDraftChange = vi.fn();
      const onDraftCommit = vi.fn();
      const onDraftCancel = vi.fn();
      render(
        <CourseCard
          signedIn
          c={reviewedCard({ pickerOpen: true, creating: true })}
          geo={EXPANDED_CARD_GEOMETRY}
          draftName="Spring"
          onDraftChange={onDraftChange}
          onDraftCommit={onDraftCommit}
          onDraftCancel={onDraftCancel}
        />,
      );

      const field = screen.getByRole("textbox", {
        name: "New collection name",
      });
      await userEvent.type(field, "{Escape}");
      expect(onDraftCancel).toHaveBeenCalledOnce();
      await userEvent.type(field, "{Enter}");
      expect(onDraftCommit).toHaveBeenCalledOnce();
    });

    // Blur fires before click. Committing on a blur into a collection row would
    // create a collection and toggle that row from the one click.
    it("does not commit the draft when focus moves within the picker", async () => {
      const onDraftCommit = vi.fn();
      const onClick = vi.fn();
      render(
        <CourseCard
          signedIn
          c={reviewedCard({
            pickerOpen: true,
            creating: true,
            collections: [
              { id: "k1", name: "Spring P3", fill: "none", tick: "", onClick },
            ],
          })}
          geo={EXPANDED_CARD_GEOMETRY}
          draftName="Spring"
          onDraftCommit={onDraftCommit}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: "Spring P3" }));
      expect(onClick).toHaveBeenCalledOnce();
      expect(onDraftCommit).not.toHaveBeenCalled();
    });

    // Unmarking would discard the grade and credits stored beside the row, so
    // the pill stops being a control once the course is marked.
    it("stops offering the taken pill once the course is marked", () => {
      render(
        <CourseCard
          signedIn
          c={reviewedCard({ onTaken: undefined })}
          geo={EXPANDED_CARD_GEOMETRY}
        />,
      );
      expect(screen.queryByRole("button", { name: /have taken/ })).toBeNull();
      expect(screen.getByTitle(/members have taken this course/)).toBeVisible();
    });
  });

  describe("the action control", () => {
    it("is Explore's split Save button under action='save'", async () => {
      const onSave = vi.fn();
      const onPicker = vi.fn();
      render(
        <CourseCard
          c={reviewedCard({ onSave, onPicker })}
          geo={EXPANDED_CARD_GEOMETRY}
          action="save"
        />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: "Save course" }),
      );
      expect(onSave).toHaveBeenCalledOnce();

      await userEvent.click(
        screen.getByRole("button", { name: "Add to collections" }),
      );
      expect(onPicker).toHaveBeenCalledOnce();
      expect(screen.queryByText("Add to comparison")).toBeNull();
    });

    it("is the picker alone under action='add'", async () => {
      const onPicker = vi.fn();
      render(
        <CourseCard
          c={reviewedCard({ onPicker })}
          geo={EXPANDED_CARD_GEOMETRY}
          action="add"
        />,
      );

      expect(screen.queryByRole("button", { name: "Save course" })).toBeNull();
      // The accessible name is the visible label, not a tidier synonym of it:
      // voice control cannot reach a control it cannot say (WCAG 2.5.3).
      const picker = screen.getByRole("button", { name: "Add to comparison" });
      expect(picker).toHaveTextContent("Add to comparison");
      await userEvent.click(picker);
      expect(onPicker).toHaveBeenCalledOnce();
    });

    it("only offers removal when the screen names it", () => {
      const onRemove = vi.fn();
      const { rerender } = render(
        <CourseCard c={reviewedCard()} geo={EXPANDED_CARD_GEOMETRY} />,
      );
      expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();

      rerender(
        <CourseCard
          c={reviewedCard({ onRemove, removeLabel: "Remove from Saved" })}
          geo={EXPANDED_CARD_GEOMETRY}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Remove from Saved" }),
      ).toBeVisible();
    });
  });

  describe("geometry", () => {
    it("hands the ramp to CSS so a container query can still override it", () => {
      const { container } = render(
        <CourseCard c={reviewedCard()} geo={EXPANDED_CARD_GEOMETRY} />,
      );
      const frame = container.firstElementChild as HTMLElement;
      expect(frame.style.getPropertyValue("--card-rail-w")).toBe("224px");
      expect(frame.style.getPropertyValue("--card-h")).toBe("236px");
    });

    it("drops the button labels at the collapsed end", () => {
      const { container } = render(
        <CourseCard c={reviewedCard()} geo={COLLAPSED_CARD_GEOMETRY} />,
      );

      expect(screen.queryByText("Write a review")).toBeNull();
      expect(screen.queryByText("Save course")).toBeNull();
      // The controls survive as icons, named by their tooltips.
      expect(
        screen.getByRole("button", { name: "Write a review" }),
      ).toBeVisible();

      const frame = container.firstElementChild as HTMLElement;
      expect(frame.style.getPropertyValue("--card-rail-w")).toBe("134px");
      expect(frame.style.getPropertyValue("--card-summary-max")).toBe("0px");
    });
  });

  it("opens the course from anywhere on the card, through one control", async () => {
    const onOpen = vi.fn();
    render(
      <CourseCard c={reviewedCard({ onOpen })} geo={EXPANDED_CARD_GEOMETRY} />,
    );

    const heading = screen.getByRole("heading", {
      name: "DD2380 Artificial Intelligence",
    });
    await userEvent.click(
      within(heading).getByRole("button", {
        name: "DD2380 Artificial Intelligence",
      }),
    );
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
