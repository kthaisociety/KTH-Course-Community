import { createHash } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { EMBEDDING_MODEL, embedBatch } from "../ai";
import { db } from "../db";
import {
  courseExaminations as courseExaminationsTable,
  courseRounds as courseRoundsTable,
  courses as coursesTable,
  type InsertCourse,
  type InsertCourseExamination,
  type InsertCourseRound,
} from "../db/schema";
import { getCourseInformation, getCourses } from "./kth-web";
import {
  findAllCourseCodes,
  findCourseExploreSourceHashes,
  upsertCourseExploreSearchState,
} from "./repository";
import type { CoursesSchema } from "./schemas";

const status = {
  running: false,
  lastStarted: null as Date | null,
  lastCompleted: null as Date | null,
  lastError: null as string | null,
};

export function getIngestStatus() {
  return { ...status };
}

function getKoppsConcurrency() {
  const raw = process.env.KOPPS_CONCURRENCY;
  const parsed = raw ? Number(raw) : 5;
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;
  return Math.floor(parsed);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function runNeonIngest(
  coursesInput?: z.infer<typeof CoursesSchema>,
) {
  if (status.running) {
    console.warn("Neon ingestion already running; skipping new request");
    return;
  }
  status.running = true;
  status.lastStarted = new Date();
  status.lastError = null;
  console.log("Neon ingestion process started...");
  try {
    const courses = coursesInput ?? (await listAllCourses());
    const establishedCourses = courses.filter(
      (course) => course.state === "ESTABLISHED",
    );
    console.log(
      `Fetched ${courses.length} courses. Filtered to ${establishedCourses.length} established courses.`,
    );

    console.log(`Converting ${establishedCourses.length} courses...`);
    const {
      courses: converted,
      rounds,
      roundCoverage,
      examinations,
    } = await convertCourses(establishedCourses);
    console.log(
      `Converted ${converted.length} courses with ${rounds.length} rounds and ${examinations.length} examination components`,
    );

    console.log("Upserting courses to database...");
    await upsertCourses(converted);
    await upsertRounds(rounds, roundCoverage);
    await upsertExaminations(examinations);

    console.log("Generating embeddings for courses...");
    await generateAndStoreEmbeddings(converted);
    console.log("Embeddings stored successfully");

    status.lastCompleted = new Date();
    console.log("Courses upserted successfully");
  } catch (error) {
    status.lastError = String(error);
    console.error("Neon ingest process failed:", error);
    throw error;
  } finally {
    status.running = false;
  }
}

/**
 * The source's list plus every catalogue course it leaves out. KTH's search
 * lists current courses only, so a course discontinued since the last run would
 * otherwise keep its old state forever. Its course page still answers, and
 * reports it discontinued; a course whose page is gone is skipped and its row
 * left as it is. The catalogue codes also seed the source's code search.
 */
async function listAllCourses(): Promise<z.infer<typeof CoursesSchema>> {
  const catalogue = await findAllCourseCodes();
  const listed = await getCourses(console.warn, catalogue);
  const listedCodes = new Set(listed.map((c) => c.code));
  const unlisted = catalogue.filter((code) => !listedCodes.has(code));
  console.log(
    `${unlisted.length} catalogue courses are not in the source's list; re-reading their pages`,
  );
  return [
    ...listed,
    ...unlisted.map((code) => ({
      code,
      name: code,
      department: "",
      // Placeholder; the stored state is the course page's.
      state: "ESTABLISHED" as const,
    })),
  ];
}

export async function runNeonTest() {
  console.log("Starting Neon test process...");
  const courses = await getCourses();
  const sample = courses
    .filter((c) => c.state === "ESTABLISHED")
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);
  console.log(`Sampled ${sample.length} courses`);
  await runNeonIngest(sample);
}

type RoundCoverage = { courseCode: string; terms: number[] };

type SearchSourceCourse = Pick<
  InsertCourse,
  "code" | "titleEng" | "titleSwe" | "goals" | "content"
>;

/** Rebuild only course_explore from the course and examination rows already in the database. */
export async function runSearchReindex() {
  const courses = await db
    .select({
      code: coursesTable.code,
      titleEng: coursesTable.titleEng,
      titleSwe: coursesTable.titleSwe,
      goals: coursesTable.goals,
      content: coursesTable.content,
    })
    .from(coursesTable);

  console.log(`Refreshing search embeddings for ${courses.length} courses...`);
  await generateAndStoreEmbeddings(courses);
  console.log("Search embeddings refreshed successfully");
}

async function convertCourses(courses: z.infer<typeof CoursesSchema>): Promise<{
  courses: InsertCourse[];
  rounds: InsertCourseRound[];
  roundCoverage: RoundCoverage[];
  examinations: InsertCourseExamination[];
}> {
  const concurrency = getKoppsConcurrency();
  let processed = 0;
  const results = await mapWithConcurrency(
    courses,
    concurrency,
    async (course) => {
      processed += 1;
      if (processed % 25 === 0) {
        console.log(
          `Neon convertCourses: processed ${processed}/${courses.length}`,
        );
      }

      const detail = await getCourseInformation(course).catch((error) => {
        console.warn(`Skipping ${course.code}: ${String(error)}`);
        return null;
      });
      if (!detail) return null;

      const latest = detail.publicSyllabusVersions.reduce(
        (a, b) => (b.validFromTerm.term > a.validFromTerm.term ? b : a),
        detail.publicSyllabusVersions[0],
      );

      const insertCourse: InsertCourse = {
        code: detail.course.courseCode,
        titleSwe: detail.course.title,
        titleEng: detail.course.titleOther,
        state: detail.course.state,
        credits: detail.course.credits,
        creditUnit: detail.course.creditUnitAbbr,
        departmentCode: detail.course.departmentCode,
        department: detail.course.department.name,
        educationalLevelCode: detail.course.educationalLevelCode,
        gradeScaleCode: detail.course.gradeScaleCode,
        goals: latest?.courseSyllabus.goals ?? "",
        content: latest?.courseSyllabus.content ?? "",
        eligibility: latest?.courseSyllabus.eligibility ?? "",
      };

      const insertRounds: InsertCourseRound[] = detail.roundInfos.map((r) => ({
        courseCode: detail.course.courseCode,
        startTerm: r.round.startTerm.term,
        studyPace: r.round.studyPace ?? null,
        schemaUrl: r.schemaUrl ?? null,
        language: r.round.language ?? null,
        tutoringForm: r.round.tutoringForm?.name ?? null,
        tutoringTimeOfDay: r.round.tutoringTimeOfDay?.name ?? null,
        formattedPeriodsAndCredits:
          r.round.courseRoundTerms?.[0]?.formattedPeriodsAndCredits ?? null,
        isPU: r.round.isPU,
        isVU: r.round.isVU,
      }));

      const latestExamSet = Object.entries(detail.examinationSets).sort(
        ([a], [b]) => b.localeCompare(a),
      )[0]?.[1];
      const insertExaminations: InsertCourseExamination[] = (
        latestExamSet?.examinationRounds ?? []
      ).map((e) => ({
        courseCode: detail.course.courseCode,
        examCode: e.examCode,
        title: e.title ?? null,
        credits: e.credits,
        gradeScaleCode: e.gradeScaleCode,
      }));

      return {
        course: insertCourse,
        rounds: insertRounds,
        roundCoverage: {
          courseCode: detail.course.courseCode,
          terms: detail.coveredRoundTerms,
        },
        examinations: insertExaminations,
      };
    },
  );

  const valid = results.filter((r) => r !== null);
  return {
    courses: valid.map((r) => r.course),
    rounds: valid.flatMap((r) => r.rounds),
    roundCoverage: valid.map((r) => r.roundCoverage),
    examinations: valid.flatMap((r) => r.examinations),
  };
}

async function upsertCourses(courses: InsertCourse[]) {
  const chunkSize = 1000;
  for (let i = 0; i < courses.length; i += chunkSize) {
    const chunk = courses.slice(i, i + chunkSize);
    await db
      .insert(coursesTable)
      .values(chunk)
      .onConflictDoUpdate({
        target: coursesTable.code,
        set: {
          titleSwe: sql`excluded.name_swedish`,
          titleEng: sql`excluded.name_english`,
          state: sql`excluded.state`,
          credits: sql`excluded.credits`,
          creditUnit: sql`excluded.credit_unit`,
          departmentCode: sql`excluded.department_code`,
          department: sql`excluded.department`,
          educationalLevelCode: sql`excluded.educational_level_code`,
          gradeScaleCode: sql`excluded.grade_scale_code`,
          goals: sql`excluded.goals`,
          content: sql`excluded.content`,
          eligibility: sql`excluded.eligibility`,
          updatedAt: sql`now()`,
        },
      });
  }
}

/**
 * Replaces each course's rounds for the terms the source reported, and only
 * those. Rounds for other terms are kept: kth.se lists current terms only, and
 * the older rounds came from KOPPS, which is closed (ADR 0004, ADR 0012).
 */
async function upsertRounds(
  rounds: InsertCourseRound[],
  coverage: RoundCoverage[],
) {
  const covered = coverage.filter((c) => c.terms.length > 0);
  const deleteChunk = 200;
  for (let i = 0; i < covered.length; i += deleteChunk) {
    await db
      .delete(courseRoundsTable)
      .where(
        or(
          ...covered
            .slice(i, i + deleteChunk)
            .map((c) =>
              and(
                eq(courseRoundsTable.courseCode, c.courseCode),
                inArray(courseRoundsTable.startTerm, c.terms),
              ),
            ),
        ),
      );
  }
  const chunkSize = 1000;
  for (let i = 0; i < rounds.length; i += chunkSize) {
    await db.insert(courseRoundsTable).values(rounds.slice(i, i + chunkSize));
  }
}

async function upsertExaminations(examinations: InsertCourseExamination[]) {
  const chunkSize = 1000;
  for (let i = 0; i < examinations.length; i += chunkSize) {
    const chunk = examinations.slice(i, i + chunkSize);
    await db
      .insert(courseExaminationsTable)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          courseExaminationsTable.courseCode,
          courseExaminationsTable.examCode,
        ],
        set: {
          title: sql`excluded.title`,
          credits: sql`excluded.credits`,
          gradeScaleCode: sql`excluded.grade_scale_code`,
        },
      });
  }
}

async function generateAndStoreEmbeddings(courses: SearchSourceCourse[]) {
  const BATCH_SIZE = 100;

  for (let i = 0; i < courses.length; i += BATCH_SIZE) {
    const batch = courses.slice(i, i + BATCH_SIZE);

    console.log(
      `Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(courses.length / BATCH_SIZE)}`,
    );

    const examinationRows = batch.length
      ? await db
          .select({
            courseCode: courseExaminationsTable.courseCode,
            examCode: courseExaminationsTable.examCode,
            title: courseExaminationsTable.title,
          })
          .from(courseExaminationsTable)
          .where(
            inArray(
              courseExaminationsTable.courseCode,
              batch.map((c) => c.code),
            ),
          )
          .orderBy(
            courseExaminationsTable.courseCode,
            courseExaminationsTable.examCode,
          )
      : [];
    const examinationTextByCode = new Map<string, string[]>();
    for (const examination of examinationRows) {
      const values = examinationTextByCode.get(examination.courseCode) ?? [];
      values.push(
        [examination.examCode, examination.title].filter(Boolean).join(" "),
      );
      examinationTextByCode.set(examination.courseCode, values);
    }

    const batchWithHash = batch.map((course) => {
      const { code, titleEng, titleSwe, goals, content } = course;
      const examinationText = examinationTextByCode.get(code)?.join(" ") ?? "";
      // Preserve the legacy embedding-hash input byte for byte so moving its
      // storage does not cause an unnecessary re-embed.
      const embeddingText = [
        code,
        titleEng,
        titleSwe,
        goals,
        content,
        examinationText,
      ]
        .filter(Boolean)
        .join(" ");
      const sourceHash = createHash("sha256")
        .update(embeddingText)
        .digest("hex");
      // This order matches the generated courses.search_vector expression
      // being retired by migration 0013, preserving full-text rank positions.
      const searchText = [
        titleEng,
        titleSwe,
        code,
        goals,
        content,
        examinationText,
      ]
        .map((value) => value ?? "")
        .join(" ");
      return { course, embeddingText, sourceHash, searchText };
    });

    const existingSourceHashByCode = await findCourseExploreSourceHashes(
      batch.map((course) => course.code),
    );

    const toEmbed = batchWithHash.filter(
      ({ course, sourceHash }) =>
        existingSourceHashByCode.get(course.code) !== sourceHash,
    );

    if (toEmbed.length === 0) {
      console.log(
        `Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}: skipped (all up to date)`,
      );
      continue;
    }

    const { embeddings } = await embedBatch(
      toEmbed.map((item) => item.embeddingText),
    );

    await Promise.all(
      toEmbed.map((item, idx) =>
        upsertCourseExploreSearchState({
          courseCode: item.course.code,
          embedding: embeddings[idx],
          sourceHash: item.sourceHash,
          searchText: item.searchText,
          embeddingModel: EMBEDDING_MODEL,
        }),
      ),
    );
  }
}
