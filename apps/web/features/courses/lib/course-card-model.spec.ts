import { describe, expect, it } from "vitest";
import type { CourseReviewStats, CourseStats } from "@/types";
import {
  type CourseCardCourse,
  type CourseCardView,
  formatCount,
  formatCourseMeta,
  keywordChips,
  toCourseCardModel,
} from "./course-card-model";

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
  approachTheoryPercent: 60,
  approachTheoryAnswerCount: 100,
  examinationDistribution: null,
  examinationAnswerCount: 90,
  examLabel: "Labs 60% · Exam 40%",
};

function view(overrides: Partial<CourseCardView> = {}): CourseCardView {
  return {
    course: COURSE,
    stats: { reviews: REVIEWS, takenCount: 1200 },
    isSaved: false,
    isTaken: false,
    ...overrides,
  };
}

const NO_REVIEWS: CourseStats = { reviews: null, takenCount: 0 };

describe("toCourseCardModel", () => {
  it("names the course the way the artboard does", () => {
    const c = toCourseCardModel(view());
    expect(c.title).toBe("DD2380 Artificial Intelligence");
    expect(c.meta).toBe("6.0 credits · EECS · Advanced");
  });

  // Scores are stored 1-10 and shown raw: 7.6 is 7.6, never 3.8. The bar is
  // that number over ten, which is the width the artboard already drew.
  it("shows 1-10 scores raw and fills the bar with value over ten", () => {
    const c = toCourseCardModel(view());
    expect(c.workload).toBe("7.6");
    expect(c.learning).toBe("8.4");
    expect(c.wlW).toBe("76%");
    expect(c.leW).toBe("84%");
  });

  describe("a course nobody has reviewed", () => {
    // `reviews` is empty today, so this is the state the app actually renders.
    it("is absent rather than zero everywhere it shows", () => {
      const c = toCourseCardModel(view({ stats: NO_REVIEWS }));

      expect(c.noReviewStats).toBe(true);
      expect(c.hasReviewStats).toBe(false);
      expect(c.noStats).toBe(true);
      expect(c.hasStats).toBe(false);

      // The three places a zero would have been a lie.
      expect(c.happyPct).not.toBe("0%");
      expect(c.workload).toBe("—");
      expect(c.learning).toBe("—");
    });

    it("still reports a genuine taken count of zero", () => {
      const c = toCourseCardModel(view({ stats: NO_REVIEWS }));
      expect(c.statTaken).toBe("0");
      expect(c.statReviews).toBe("0");
    });
  });

  // Reviewed, but nobody remembered how the course was examined. Saying "No
  // reviews yet" there would be as wrong as saying 0% happy for an unreviewed
  // one, so both flags are false and the pill simply does not render.
  it("keeps a missing examination split distinct from having no reviews", () => {
    const c = toCourseCardModel(
      view({
        stats: {
          reviews: { ...REVIEWS, examLabel: null },
          takenCount: 12,
        },
      }),
    );
    expect(c.hasStats).toBe(false);
    expect(c.noStats).toBe(false);
    expect(c.examLabel).toBe("");
    expect(c.hasReviewStats).toBe(true);
  });

  describe("prerequisites", () => {
    // `course_prerequisites` is a real table that nothing writes, so "None
    // listed" would assert a fact we never established.
    it("renders neither chips nor 'None listed' when none were extracted", () => {
      const c = toCourseCardModel(view({ prerequisites: null }));
      expect(c.hasPrereq).toBe(false);
      expect(c.noPrereq).toBe(false);
      expect(c.prereqCourses).toEqual([]);
    });

    it("says 'None listed' only when extraction found none", () => {
      const c = toCourseCardModel(view({ prerequisites: [] }));
      expect(c.noPrereq).toBe(true);
      expect(c.hasPrereq).toBe(false);
    });

    it("pills a prerequisite the viewer has separately marked taken", () => {
      const c = toCourseCardModel(
        view({
          prerequisites: [
            {
              code: "DD1337",
              name: "Programming",
              inCatalog: true,
              taken: true,
            },
            { code: "SF1918", name: "Statistics", inCatalog: true },
          ],
        }),
      );
      expect(c.prereq).toBe("DD1337, SF1918");
      expect(c.prereqCourses[0]?.radius).toBe("999px");
      expect(c.prereqCourses[1]?.radius).toBe("6px");
      // The tick is display-only; nothing here marks the prerequisite taken.
      expect(c.prereqCourses[1]?.taken).toBeUndefined();
    });
  });

  // The artboard's "students" came from real KTH enrolment in the design's mock
  // store. `user_taken_courses` counts app users who marked it themselves.
  describe("the taken pill's tooltip", () => {
    it("says members, never students", () => {
      const c = toCourseCardModel(view());
      expect(c.takenTitle).toContain("1.2k members have taken this course");
      expect(c.takenTitle).not.toContain("students");
    });

    it("does not claim a count when there is none", () => {
      const c = toCourseCardModel(view({ stats: NO_REVIEWS }));
      expect(c.takenTitle).toBe(
        "No members have marked this course as taken · click to mark as taken",
      );
    });

    it("agrees with itself for a single member", () => {
      const c = toCourseCardModel(
        view({ stats: { reviews: null, takenCount: 1 } }),
      );
      expect(c.takenTitle).toContain("1 member has taken this course");
    });
  });

  it("reflects the viewer's own saved and taken state", () => {
    const c = toCourseCardModel(view({ isSaved: true, isTaken: true }));
    expect(c.saveLabel).toBe("Saved");
    expect(c.saveBorder).toBe("var(--cc-brand)");
    expect(c.takenCountFg).toBe("var(--cc-brand)");
  });

  // Styling goes through the palette so light and dark both work; the model
  // carries the per-card values the tokens cannot express as one class.
  it("carries tokens rather than raw colours", () => {
    const c = toCourseCardModel(view());
    for (const colour of [
      c.borderColor,
      c.takenCountFg,
      c.saveFg,
      c.saveBorder,
    ]) {
      expect(colour).toMatch(/^var\(--cc-|^transparent$|^currentColor$|^none$/);
    }
  });

  // Both have their header drawn over an empty section: keywords have no column
  // at all, and the summary would otherwise repeat KOPPS boilerplate on every
  // card in a grid. #73 fills them.
  it("leaves keywords and the summary empty", () => {
    const c = toCourseCardModel(view());
    expect(c.keywords).toBe("");
    expect(c.summary).toBe("");
    expect(c.summaryClipped).toBe("");
  });

  it("only enables the remove button when a screen names it", () => {
    expect(toCourseCardModel(view()).removeLabel).toBeUndefined();
    expect(
      toCourseCardModel(view({ removeLabel: "Remove from Saved" })).removeLabel,
    ).toBe("Remove from Saved");
  });
});

describe("formatCourseMeta", () => {
  it("drops what the course does not have rather than leaving separators", () => {
    expect(
      formatCourseMeta({
        courseCode: "SF1918",
        titleEng: "Statistics",
        credits: null,
        department: "SCI",
      }),
    ).toBe("SCI");
  });
});

describe("formatCount", () => {
  it("abbreviates only once the pill would overflow", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(940)).toBe("940");
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(1200)).toBe("1.2k");
    expect(formatCount(2450)).toBe("2.5k");
    expect(formatCount(24_000)).toBe("24k");
  });
});

describe("keywordChips", () => {
  it("counts what will not fit on the single row", () => {
    expect(keywordChips("search, planning, agents, logic")).toEqual([
      { label: "search", flex: "0 1 auto" },
      { label: "planning", flex: "0 1 auto" },
      { label: "+2", flex: "none" },
    ]);
  });

  it("has nothing to draw while keywords are unbacked", () => {
    expect(keywordChips("")).toEqual([]);
  });
});
