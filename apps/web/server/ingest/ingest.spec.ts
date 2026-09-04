import { sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "../db";
import { runNeonIngest } from "./ingest";
import { getCourseInformation } from "./kopps";

vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite();
  return { db: drizzle(client) };
});

vi.mock("../ai", () => ({
  EMBEDDING_MODEL: "test-embedding-model",
  embedBatch: vi.fn().mockResolvedValue({ embeddings: [[0]] }),
}));

vi.mock("./kopps", () => ({
  getCourses: vi.fn(),
  getCourseInformation: vi.fn(),
}));

vi.mock("./repository", () => ({
  findCourseExploreSourceHashes: vi.fn().mockResolvedValue(new Map()),
  upsertCourseExploreSearchState: vi.fn().mockResolvedValue(undefined),
}));

const courseInput = [
  {
    department: "SCI",
    code: "AA0001",
    name: "Source course",
    state: "ESTABLISHED" as const,
  },
];

function courseDetail(input: {
  goals: string;
  content: string;
  eligibility: string;
}): Awaited<ReturnType<typeof getCourseInformation>> {
  return {
    course: {
      courseCode: "AA0001",
      departmentCode: "SCI",
      department: { name: "Science" },
      educationalLevelCode: "G1N",
      gradeScaleCode: "AF",
      title: "Källkurs",
      titleOther: "Source course",
      credits: 7.5,
      creditUnitAbbr: "hp",
      state: "ESTABLISHED",
    },
    roundInfos: [],
    examinationSets: {},
    publicSyllabusVersions: [
      {
        validFromTerm: { term: 20261 },
        courseSyllabus: input,
      },
    ],
    mainSubjects: [],
  };
}

function testClient() {
  return (
    db as unknown as {
      $client: {
        exec: (query: string) => Promise<unknown>;
        close: () => Promise<void>;
      };
    }
  ).$client;
}

beforeAll(async () => {
  await testClient().exec(`
    CREATE TABLE courses (
      code text PRIMARY KEY,
      name_swedish text NOT NULL,
      name_english text NOT NULL,
      state text NOT NULL,
      credits real NOT NULL,
      credit_unit text,
      department_code text NOT NULL,
      department text NOT NULL,
      educational_level_code text,
      grade_scale_code text,
      goals text,
      content text,
      eligibility text,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    );
    CREATE TABLE course_explore (
      course_code text PRIMARY KEY REFERENCES courses(code) ON DELETE CASCADE,
      summary text,
      summary_version text,
      summary_generated_at timestamptz,
      eligibility_version text,
      eligibility_extracted_at timestamptz,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    );
    CREATE TABLE keywords (
      id serial PRIMARY KEY,
      term text NOT NULL UNIQUE,
      created_at timestamptz DEFAULT now() NOT NULL
    );
    CREATE TABLE course_keywords (
      course_code text NOT NULL REFERENCES courses(code),
      keyword_id integer NOT NULL REFERENCES keywords(id),
      created_at timestamptz DEFAULT now() NOT NULL,
      PRIMARY KEY (course_code, keyword_id)
    );
    CREATE TABLE course_prerequisites (
      course_code text NOT NULL REFERENCES courses(code),
      prerequisite_course_code text NOT NULL REFERENCES courses(code),
      created_at timestamptz DEFAULT now() NOT NULL,
      PRIMARY KEY (course_code, prerequisite_course_code)
    );
  `);
});

afterAll(async () => {
  await testClient().close();
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  await db.execute(
    sql.raw(
      "TRUNCATE course_keywords, course_prerequisites, keywords, course_explore, courses RESTART IDENTITY CASCADE",
    ),
  );
});

async function importCourse(source: {
  goals: string;
  content: string;
  eligibility: string;
}) {
  vi.mocked(getCourseInformation).mockResolvedValueOnce(courseDetail(source));
  await runNeonIngest(courseInput);
}

async function seedDerivedState(summary: string) {
  await testClient().exec(`
    INSERT INTO courses (
      code, name_swedish, name_english, state, credits,
      department_code, department
    ) VALUES ('AA0002', 'Förkunskapskurs', 'Prerequisite course',
      'ESTABLISHED', 7.5, 'SCI', 'Science');
    INSERT INTO course_explore (
      course_code, summary, summary_version, summary_generated_at,
      eligibility_version, eligibility_extracted_at
    ) VALUES (
      'AA0001', '${summary}', 'summary-v1:test', now(),
      'eligibility-v1:test', now()
    );
    INSERT INTO keywords (term) VALUES ('analysis');
    INSERT INTO course_keywords (course_code, keyword_id)
      VALUES ('AA0001', 1);
    INSERT INTO course_prerequisites (
      course_code, prerequisite_course_code
    ) VALUES ('AA0001', 'AA0002');
  `);
}

async function readDerivedState() {
  const explore = await db.execute<{
    summary: string | null;
    summaryVersion: string | null;
    summaryGenerated: boolean;
    eligibilityVersion: string | null;
    eligibilityExtracted: boolean;
  }>(
    sql.raw(`
      SELECT
        summary,
        summary_version AS "summaryVersion",
        summary_generated_at IS NOT NULL AS "summaryGenerated",
        eligibility_version AS "eligibilityVersion",
        eligibility_extracted_at IS NOT NULL AS "eligibilityExtracted"
      FROM course_explore
      WHERE course_code = 'AA0001'
    `),
  );
  const keywordRows = await db.execute<{ term: string }>(
    sql.raw(`
      SELECT keywords.term
      FROM course_keywords
      JOIN keywords ON keywords.id = course_keywords.keyword_id
      WHERE course_keywords.course_code = 'AA0001'
    `),
  );
  const prerequisiteRows = await db.execute<{
    prerequisiteCourseCode: string;
  }>(
    sql.raw(`
      SELECT prerequisite_course_code AS "prerequisiteCourseCode"
      FROM course_prerequisites
      WHERE course_code = 'AA0001'
    `),
  );

  return {
    ...explore.rows[0],
    keywords: keywordRows.rows.map((row) => row.term),
    prerequisites: prerequisiteRows.rows.map(
      (row) => row.prerequisiteCourseCode,
    ),
  };
}

describe("runNeonIngest", () => {
  it("invalidates summary and keywords when their source prose changes", async () => {
    await importCourse({
      goals: "Old goals",
      content: "Old content",
      eligibility: "AA0002",
    });
    await seedDerivedState("Old summary");

    await importCourse({
      goals: "Revised goals",
      content: "Revised content",
      eligibility: "AA0002",
    });

    await expect(readDerivedState()).resolves.toEqual({
      summary: null,
      summaryVersion: null,
      summaryGenerated: false,
      eligibilityVersion: "eligibility-v1:test",
      eligibilityExtracted: true,
      keywords: [],
      prerequisites: ["AA0002"],
    });
  });

  it("invalidates prerequisites when eligibility changes", async () => {
    await importCourse({
      goals: "Stable goals",
      content: "Stable content",
      eligibility: "AA0002",
    });
    await seedDerivedState("Current summary");

    await importCourse({
      goals: "Stable goals",
      content: "Stable content",
      eligibility: "No prerequisites",
    });

    await expect(readDerivedState()).resolves.toEqual({
      summary: "Current summary",
      summaryVersion: "summary-v1:test",
      summaryGenerated: true,
      eligibilityVersion: null,
      eligibilityExtracted: false,
      keywords: ["analysis"],
      prerequisites: [],
    });
  });
});
