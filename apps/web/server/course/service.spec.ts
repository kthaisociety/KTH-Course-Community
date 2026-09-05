import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseStats } from "@/types";
import type { SelectCourse } from "../db/schema";
import {
  getAggregatesByCourseCodes,
  type ReviewAggregate,
} from "../reviews/service";
import { getTakenCountsByCourseCodes } from "../taken/service";
import * as courseRepo from "./repository";
import { getStatsByCodes, getSummary } from "./service";

vi.mock("./repository");
vi.mock("../reviews/service");
vi.mock("../taken/service");

/** The review half of the one course under test, or `null` when absent. */
function reviewsOf(byCode: Map<string, CourseStats>) {
  return byCode.get("SF1625")?.reviews;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([]);
  vi.mocked(getTakenCountsByCourseCodes).mockResolvedValue([]);
});

/** A row as `getAggregatesByCourseCodes` returns it, with everything answered. */
function aggregate(overrides: Partial<ReviewAggregate> = {}): ReviewAggregate {
  return {
    courseCode: "SF1625",
    reviewCount: 1,
    happyCount: 1,
    workloadMean: 8,
    learningMean: 9,
    approachTheoryMean: 70,
    approachTheoryAnswerCount: 1,
    examinationAnswerCount: 1,
    examinationMeans: {
      exam: 50,
      assignments: 20,
      labs: 10,
      projects: 10,
      seminars: 5,
      other: 5,
    },
    ...overrides,
  };
}

describe("getStatsByCodes", () => {
  it("reports a course nobody has reviewed as absent, never as zero", async () => {
    const stats = await getStatsByCodes(["SF1625"]);

    expect(stats.get("SF1625")).toEqual({ reviews: null, takenCount: 0 });
  });

  it("renders a single review as the numbers the card shows", async () => {
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([aggregate()]);

    expect(reviewsOf(await getStatsByCodes(["SF1625"]))).toEqual({
      reviewCount: 1,
      happyCount: 1,
      happyPercent: 100,
      workloadMean: 8,
      learningMean: 9,
      approachTheoryPercent: 70,
      approachTheoryAnswerCount: 1,
      examinationDistribution: {
        exam: 50,
        assignments: 20,
        labs: 10,
        projects: 10,
        seminars: 5,
        other: 5,
      },
      examinationAnswerCount: 1,
      examLabel: "Exam 50% · Assignments 20% · Labs 10%",
    });
  });

  it("means a recollection over the reviewers who had one, and says how many", async () => {
    // Four reviews; two remembered the theory split, at 60% and 80%. The mean
    // of those who answered is 70%, not the 35% you get by counting the two
    // "I don't remember" answers as zero.
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      aggregate({
        reviewCount: 4,
        happyCount: 3,
        approachTheoryMean: 70,
        approachTheoryAnswerCount: 2,
        examinationAnswerCount: 2,
      }),
    ]);

    const reviews = reviewsOf(await getStatsByCodes(["SF1625"]));

    expect(reviews).toMatchObject({
      reviewCount: 4,
      happyPercent: 75,
      approachTheoryPercent: 70,
      approachTheoryAnswerCount: 2,
      examinationAnswerCount: 2,
    });
  });

  it("drops a recollection nobody had, while still reporting the scores", async () => {
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      aggregate({
        reviewCount: 3,
        happyCount: 2,
        approachTheoryMean: null,
        approachTheoryAnswerCount: 0,
        examinationAnswerCount: 0,
        examinationMeans: null,
      }),
    ]);

    // Workload and learning are NOT NULL columns, so they survive a course
    // where every reviewer answered "I don't remember" to everything else.
    expect(reviewsOf(await getStatsByCodes(["SF1625"]))).toMatchObject({
      reviewCount: 3,
      happyPercent: 67,
      workloadMean: 8,
      learningMean: 9,
      approachTheoryPercent: null,
      approachTheoryAnswerCount: 0,
      examinationDistribution: null,
      examinationAnswerCount: 0,
      examLabel: null,
    });
  });

  it("re-rounds a mean distribution back to shares that still add up to 100", async () => {
    // Three reviewers who each split a course three ways average to 33.33%
    // apiece. Rounded on their own that is 99% and the bar chart has a gap.
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      aggregate({
        reviewCount: 3,
        examinationAnswerCount: 3,
        examinationMeans: {
          exam: 100 / 3,
          assignments: 100 / 3,
          labs: 100 / 3,
          projects: 0,
          seminars: 0,
          other: 0,
        },
      }),
    ]);

    const reviews = reviewsOf(await getStatsByCodes(["SF1625"]));

    expect(reviews?.examinationDistribution).toEqual({
      exam: 34,
      assignments: 33,
      labs: 33,
      projects: 0,
      seminars: 0,
      other: 0,
    });
    expect(reviews?.examLabel).toBe("Exam 34% · Assignments 33% · Labs 33%");
  });

  it("names at most three shares and never a share nobody reported", async () => {
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      aggregate({
        examinationMeans: {
          exam: 40,
          assignments: 0,
          labs: 60,
          projects: 0,
          seminars: 0,
          other: 0,
        },
      }),
    ]);

    expect(reviewsOf(await getStatsByCodes(["SF1625"]))?.examLabel).toBe(
      "Labs 60% · Exam 40%",
    );
  });

  it("reports the scores on the stored 1-10 scale, to one decimal", async () => {
    // 8 + 7 + 8 over three reviewers is 7.666…, which the card shows as 7.7.
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      aggregate({ reviewCount: 3, workloadMean: 23 / 3, learningMean: 19 / 3 }),
    ]);

    expect(reviewsOf(await getStatsByCodes(["SF1625"]))).toMatchObject({
      workloadMean: 7.7,
      learningMean: 6.3,
    });
  });

  it("serves a page of cards from one aggregate call per table", async () => {
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      aggregate({ courseCode: "DD2421", reviewCount: 2, happyCount: 1 }),
    ]);
    vi.mocked(getTakenCountsByCourseCodes).mockResolvedValue([
      { courseCode: "SF1625", takenCount: 1200 },
    ]);

    const byCode = await getStatsByCodes(["SF1625", "DD2421", "SF1625"]);

    expect(getAggregatesByCourseCodes).toHaveBeenCalledTimes(1);
    expect(getAggregatesByCourseCodes).toHaveBeenCalledWith([
      "SF1625",
      "DD2421",
    ]);
    expect(getTakenCountsByCourseCodes).toHaveBeenCalledTimes(1);
    expect(byCode.get("SF1625")).toEqual({ reviews: null, takenCount: 1200 });
    expect(byCode.get("DD2421")?.reviews).toMatchObject({
      reviewCount: 2,
      happyPercent: 50,
    });
    expect(byCode.get("DD2421")?.takenCount).toBe(0);
  });

  it("asks the database nothing when there are no courses to aggregate", async () => {
    await expect(getStatsByCodes([])).resolves.toEqual(new Map());

    expect(getAggregatesByCourseCodes).not.toHaveBeenCalled();
    expect(getTakenCountsByCourseCodes).not.toHaveBeenCalled();
  });
});

const course = {
  code: "SF1625",
  titleSwe: "Envariabelanalys",
  titleEng: "Calculus in One Variable",
  state: "ESTABLISHED",
  credits: 7.5,
  creditUnit: "hp",
  departmentCode: "SCI",
  department: "SCI/Mathematics",
  educationalLevelCode: "BASIC",
  gradeScaleCode: "AF",
  goals: null,
  content: null,
  eligibility: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} as unknown as SelectCourse;

describe("getSummary", () => {
  beforeEach(() => {
    vi.mocked(courseRepo.findByCode).mockResolvedValue(course);
    vi.mocked(courseRepo.findRoundSummaries).mockResolvedValue([]);
    vi.mocked(courseRepo.findExamCodes).mockResolvedValue([]);
  });

  it("carries the aggregate numbers the card renders", async () => {
    vi.mocked(getAggregatesByCourseCodes).mockResolvedValue([
      aggregate({ reviewCount: 4, happyCount: 3 }),
    ]);
    vi.mocked(getTakenCountsByCourseCodes).mockResolvedValue([
      { courseCode: "SF1625", takenCount: 1200 },
    ]);

    const summary = await getSummary("SF1625");

    expect(summary?.stats.takenCount).toBe(1200);
    expect(summary?.stats.reviews).toMatchObject({
      reviewCount: 4,
      happyPercent: 75,
      workloadMean: 8,
    });
  });

  it("shows an unreviewed course's catalogue fields with no review numbers", async () => {
    const summary = await getSummary("SF1625");

    expect(summary?.courseCode).toBe("SF1625");
    expect(summary?.stats).toEqual({ reviews: null, takenCount: 0 });
  });
});
