import { createHash } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { EMBEDDING_MODEL, embedBatch } from "../ai";
import { db } from "../db";
import {
  courseExaminations as courseExaminationsTable,
  courseExplore,
  courseKeywords,
  coursePrerequisites,
  courseRounds as courseRoundsTable,
  courses as coursesTable,
  type InsertCourse,
  type InsertCourseExamination,
  type InsertCourseRound,
} from "../db/schema";
import { getCourseInformation, getCourses } from "./kopps";
import {
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
    const courses = coursesInput ?? (await getCourses());
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
      examinations,
    } = await convertCourses(establishedCourses);
    console.log(
      `Converted ${converted.length} courses with ${rounds.length} rounds and ${examinations.length} examination components`,
    );

    console.log("Upserting courses to database...");
    await upsertCourses(converted);
    await upsertRounds(rounds);
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

async function convertCourses(courses: z.infer<typeof CoursesSchema>): Promise<{
  courses: InsertCourse[];
  rounds: InsertCourseRound[];
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

      const detail = await getCourseInformation(course).catch(() => null);
      if (!detail) return null;

      const latest = detail.publicSyllabusVersions.reduce(
        (a, b) => (b.validFromTerm.term > a.validFromTerm.term ? b : a),
        detail.publicSyllabusVersions[0],
      );

      const insertCourse: InsertCourse = {
        code: detail.course.courseCode,
        titleSwe: detail.course.title,
        titleEng: detail.course.titleOther,
        state: course.state,
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
        examinations: insertExaminations,
      };
    },
  );

  const valid = results.filter((r) => r !== null);
  return {
    courses: valid.map((r) => r.course),
    rounds: valid.flatMap((r) => r.rounds),
    examinations: valid.flatMap((r) => r.examinations),
  };
}

async function upsertCourses(courses: InsertCourse[]) {
  const chunkSize = 1000;
  for (let i = 0; i < courses.length; i += chunkSize) {
    const chunk = courses.slice(i, i + chunkSize);
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          code: coursesTable.code,
          goals: coursesTable.goals,
          content: coursesTable.content,
          eligibility: coursesTable.eligibility,
        })
        .from(coursesTable)
        .where(
          inArray(
            coursesTable.code,
            chunk.map((course) => course.code),
          ),
        )
        .for("update");
      const existingByCode = new Map(
        existing.map((course) => [course.code, course]),
      );
      const summaryChangedCourseCodes = chunk.flatMap((course) => {
        const previous = existingByCode.get(course.code);
        return previous &&
          (previous.goals !== course.goals ||
            previous.content !== course.content)
          ? [course.code]
          : [];
      });
      const eligibilityChangedCourseCodes = chunk.flatMap((course) => {
        const previous = existingByCode.get(course.code);
        return previous && previous.eligibility !== course.eligibility
          ? [course.code]
          : [];
      });

      await tx
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

      if (summaryChangedCourseCodes.length > 0) {
        await tx
          .update(courseExplore)
          .set({
            summary: null,
            summaryVersion: null,
            summaryGeneratedAt: null,
            updatedAt: sql`now()`,
          })
          .where(inArray(courseExplore.courseCode, summaryChangedCourseCodes));
        await tx
          .delete(courseKeywords)
          .where(inArray(courseKeywords.courseCode, summaryChangedCourseCodes));
      }

      if (eligibilityChangedCourseCodes.length > 0) {
        await tx
          .update(courseExplore)
          .set({
            eligibilityVersion: null,
            eligibilityExtractedAt: null,
            updatedAt: sql`now()`,
          })
          .where(
            inArray(courseExplore.courseCode, eligibilityChangedCourseCodes),
          );
        await tx
          .delete(coursePrerequisites)
          .where(
            inArray(
              coursePrerequisites.courseCode,
              eligibilityChangedCourseCodes,
            ),
          );
      }
    });
  }
}

async function upsertRounds(rounds: InsertCourseRound[]) {
  if (!rounds.length) return;
  const courseCodes = [...new Set(rounds.map((r) => r.courseCode))];
  await db
    .delete(courseRoundsTable)
    .where(inArray(courseRoundsTable.courseCode, courseCodes));
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

async function generateAndStoreEmbeddings(courses: InsertCourse[]) {
  const BATCH_SIZE = 100;

  for (let i = 0; i < courses.length; i += BATCH_SIZE) {
    const batch = courses.slice(i, i + BATCH_SIZE);

    console.log(
      `Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(courses.length / BATCH_SIZE)}`,
    );

    const batchWithHash = batch.map((course) => {
      const { code, titleEng, titleSwe, goals, content } = course;
      // Preserve the legacy embedding-hash input byte for byte so moving its
      // storage does not cause an unnecessary re-embed.
      const embeddingText = [code, titleEng, titleSwe, goals, content]
        .filter(Boolean)
        .join(" ");
      const sourceHash = createHash("sha256")
        .update(embeddingText)
        .digest("hex");
      // This order matches the generated courses.search_vector expression
      // being retired by migration 0013, preserving full-text rank positions.
      const searchText = [titleEng, titleSwe, code, goals, content]
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
