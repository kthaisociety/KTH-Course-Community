import type { Client as ESClient } from "@elastic/elasticsearch";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { inArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { z } from "zod";
import {
  courseExaminations as courseExaminationsTable,
  courseRounds as courseRoundsTable,
  courses as coursesTable,
  type InsertCourse,
  type InsertCourseExamination,
  type InsertCourseRound,
} from "../../../types/database/schema";
import {
  CourseDetailSchema,
  type CourseDocument,
  CourseSchema,
  CoursesSchema,
} from "../../../types/ingest/schemas";
import { DRIZZLE } from "../database/drizzle.module";
import { ES } from "../search/search.constants.js";
import { KoppsService } from "./kopps.service";

const INDEX = "courses";

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly kopps: KoppsService,
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase,
    @Inject(ES) private readonly es: ESClient,
  ) {}

  // used for checking ingest status
  private readonly status = {
    neon: {
      running: false,
      lastStarted: null as Date | null,
      lastCompleted: null as Date | null,
      lastError: null as string | null,
    },
    elastic: {
      running: false,
      lastStarted: null as Date | null,
      lastCompleted: null as Date | null,
      lastError: null as string | null,
    },
  };

  getIngestStatus() {
    return {
      neon: { ...this.status.neon },
      elastic: { ...this.status.elastic },
    };
  }

  // runs the ingestion pipeline --> inserts into SQL tables (Neon) and ElasticSearch.
  async runFullIngest() {
    this.logger.log("Starting full ingest process...");
    await this.runNeonIngest();
    await this.runElasticIngest();
  }

  // ingests courses into neon db
  async runNeonIngest() {
    this.status.neon.running = true;
    this.status.neon.lastStarted = new Date();
    this.status.neon.lastError = null;
    this.logger.log("Neon ingestion process started...");
    try {
      this.logger.log("Fetching courses from KTH API...");
      const courses = await this.kopps.getCourses();
      const establishedCourses = courses
        .filter( (course) => course.state === "ESTABLISHED");
      this.logger.log(`Fetched ${courses.length} courses. Filtered to ${establishedCourses.length} established courses.`);

      this.logger.log(`Converting ${establishedCourses.length} courses...`);
      const {
        courses: converted,
        rounds,
        examinations,
      } = await this.convertCourses(establishedCourses);
      this.logger.log(
        `Converted ${converted.length} courses with ${rounds.length} rounds and ${examinations.length} examination components`,
      );

      this.logger.log("Upserting courses to database...");
      await this.upsertCourses(converted);
      await this.upsertRounds(rounds);
      await this.upsertExaminations(examinations);
      this.status.neon.lastCompleted = new Date();
      this.logger.log("Courses upserted successfully");
    } catch (error) {
      this.status.neon.lastError = String(error);
      this.logger.error("Neon ingest process failed:", error);
      throw error;
    } finally {
      this.status.neon.running = false;
    }
  }

  // ingests into elastic db
  async runElasticIngest() {
    this.status.elastic.running = true;
    this.status.elastic.lastStarted = new Date();
    this.status.elastic.lastError = null;
    this.logger.log("Elastic ingestion process started...");
    try {
      this.logger.log("Fetching courses from KTH API...");
      const courses = await this.kopps.getCourses();
      this.logger.log(`Fetched ${courses.length} courses`);

      // TODO: Need to convert API coursesed info to Elastic Document as well
      this.logger.log("Getting bulk documents for Elasticsearch...");
      const docs = await this.getBulkDocs(courses);
      this.logger.log(`Prepared ${docs.length} documents for indexing`);

      this.logger.log("Indexing documents to Elasticsearch...");
      await this.indexBulk(docs);
      this.status.elastic.lastCompleted = new Date();
      this.logger.log("Elastic ingest process completed successfully");
    } catch (error) {
      this.status.elastic.lastError = String(error);
      this.logger.error("Elastic ingest process failed:", error);
      throw error;
    } finally {
      this.status.elastic.running = false;
    }
  }

  /* 
    Converts courses to fit db schema, fetches courses for each course. 
    Also maps to course rounds directly --> courses can have different rounds. 
    E.g. DD2421 is offered in both P1 and P3. 
  */
  private async convertCourses(
    courses: z.infer<typeof CoursesSchema>,
  ): Promise<{
    courses: InsertCourse[];
    rounds: InsertCourseRound[];
    examinations: InsertCourseExamination[];
  }> {
    const results = await Promise.all(
      courses.map(async (course) => {
        const courses = await this.kopps
          .getCourseInformation(course)
          .catch(() => null);
        if (!courses) return null;

        // API returns all historic syllabuses in an array, this fetches just the latest
        const latest = courses.publicSyllabusVersions.reduce(
          (a, b) => (b.validFromTerm.term > a.validFromTerm.term ? b : a),
          courses.publicSyllabusVersions[0],
        );

        const insertCourse: InsertCourse = {
          code: courses.course.courseCode,
          name: courses.course.titleOther,
          titleSwe: courses.course.title,
          titleEng: courses.course.titleOther,
          state: course.state,
          credits: courses.course.credits,
          creditUnit: courses.course.creditUnitAbbr,
          departmentCode: courses.course.departmentCode,
          department: courses.course.department.name,
          educationalLevelCode: courses.course.educationalLevelCode,
          gradeScaleCode: courses.course.gradeScaleCode,
          goals: latest?.courseSyllabus.goals ?? "",
          content: latest?.courseSyllabus.content ?? "",
          eligibility: latest?.courseSyllabus.eligibility ?? "",
        };

        const insertRounds: InsertCourseRound[] = courses.roundInfos.map(
          (r) => ({
            courseCode: courses.course.courseCode,
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
          }),
        );

        // examinationSets are historical sets of examination. The latest one is the current set.
        const latestExamSet = Object.entries(courses.examinationSets).sort(
          ([a], [b]) => b.localeCompare(a),
        )[0]?.[1];
        const insertExaminations: InsertCourseExamination[] = (
          latestExamSet?.examinationRounds ?? []
        ).map((e) => ({
          courseCode: courses.course.courseCode,
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
      }),
    );

    const valid = results.filter((r) => r !== null);
    return {
      courses: valid.map((r) => r.course),
      rounds: valid.flatMap((r) => r.rounds),
      examinations: valid.flatMap((r) => r.examinations),
    };
  }

  // inserts courses into db
  private async upsertCourses(courses: InsertCourse[]) {
    const chunkSize = 1000; // TODO: Comment on chunk size
    for (let i = 0; i < courses.length; i += chunkSize) {
      const chunk = courses.slice(i, i + chunkSize);
      await this.db
        .insert(coursesTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: coursesTable.code,
          set: {
            name: sql`excluded.name`,
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

  // inserts round infos to database — delete existing rounds per course, then insert fresh
  private async upsertRounds(rounds: InsertCourseRound[]) {
    if (!rounds.length) return;
    const courseCodes = [...new Set(rounds.map((r) => r.courseCode))];
    await this.db
      .delete(courseRoundsTable)
      .where(inArray(courseRoundsTable.courseCode, courseCodes));
    const chunkSize = 1000;
    for (let i = 0; i < rounds.length; i += chunkSize) {
      await this.db
        .insert(courseRoundsTable)
        .values(rounds.slice(i, i + chunkSize));
    }
  }

  // inserts examination components into db
  private async upsertExaminations(examinations: InsertCourseExamination[]) {
    const chunkSize = 1000;
    for (let i = 0; i < examinations.length; i += chunkSize) {
      const chunk = examinations.slice(i, i + chunkSize);
      await this.db
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

  // maps coursesed course data to an ES document
  private toDocument(
    courses: z.infer<typeof CourseDetailSchema>,
    course: z.infer<typeof CourseSchema>,
  ): CourseDocument {
    // pick the latest syllabus version by term
    const latest = courses.publicSyllabusVersions.reduce(
      (a, b) => (b.validFromTerm.term > a.validFromTerm.term ? b : a),
      courses.publicSyllabusVersions[0],
    );
    return {
      course_name: course.name,
      course_code: course.code,
      department: course.department,
      state: course.state,
      goals: latest?.courseSyllabus.goals ?? "",
      content: latest?.courseSyllabus.content ?? "",
      subject: courses.mainSubjects[0] ?? "", // TODO: rename to just "subject". But need to double check if its always 1 subject or more
      // flatMap: courseRoundTerms is an array per round, so map would give string[][]
      periods: courses.roundInfos
        .flatMap((r) => r.round.courseRoundTerms ?? [])
        .map((t) => t.formattedPeriodsAndCredits ?? "")
        .filter(Boolean),
      short_name: "",
      course_category: [], // technically can be both
    };
  }

  private async ensureIndex() {
    try {
      await this.es.indices.create({
        index: INDEX,
        settings: { number_of_shards: 1, number_of_replicas: 1 },
        mappings: {
          dynamic: "strict",
          properties: {
            course_name: {
              type: "text",
              fields: { keyword: { type: "keyword", ignore_above: 256 } },
            },
            course_code: { type: "keyword" },
            department: { type: "keyword" },
            state: { type: "keyword" },
            goals: { type: "text" },
            content: { type: "text" },
          },
        },
      });
    } catch (e: unknown) {
      type EsError = {
        meta?: { statusCode?: number; body?: { error?: { type?: string } } };
      };
      const err = e as EsError;
      const status = err.meta?.statusCode;
      const type = err.meta?.body?.error?.type;
      if (status === 400 && type === "resource_already_exists_exception")
        return;
      if (status === 403) {
        this.logger.error(`403 creating index "${INDEX}". Check privileges.`);
      }
      throw e;
    }
  }

  private docsToBulkOperations(docs: CourseDocument[]) {
    type IndexOp = { index: { _index: string; _id: string } };
    const ops: Array<IndexOp | CourseDocument> = [];
    for (const d of docs) {
      ops.push({ index: { _index: INDEX, _id: d.course_code } });
      ops.push(d);
    }
    return ops;
  }

  private async indexBulk(docs: CourseDocument[]) {
    if (!docs.length) {
      this.logger.warn("No course documents to index; skipping bulk request");
      return;
    }
    await this.ensureIndex();
    const operations = this.docsToBulkOperations(docs);
    const res = await this.es.bulk({ refresh: "true", operations });

    if (!res.errors) {
      this.logger.log(`Bulk OK: ${res.items.length} indexed`);
      return;
    }
    type BulkItem = Record<
      string,
      {
        _id?: string;
        status?: number;
        error?: { type?: string; reason?: string; caused_by?: unknown };
      }
    >;
    type Failure = {
      pos: number;
      id?: string;
      status?: number;
      type?: string;
      reason?: string;
      caused_by?: unknown;
    };
    const failures = (res.items as BulkItem[])
      .map((item, i): Failure | null => {
        const action = Object.keys(item)[0];
        const r = item[action];
        if (!r?.error) return null;
        return {
          pos: i,
          id: r._id,
          status: r.status,
          type: r.error?.type,
          reason: r.error?.reason,
          caused_by: r.error?.caused_by,
        };
      })
      .filter((x): x is Failure => x !== null);

    this.logger.error(`Bulk had ${failures.length} failures`);
    const summary = failures
      .slice(0, 5)
      .map((f) => `[${f.status}] ${f.type}: ${f.reason} (id=${f.id})`)
      .join("; ");
    throw new Error(
      `Bulk indexing failed for ${failures.length}/${res.items.length} items: ${summary}`,
    );
  }

  private async getBulkDocs(courses: z.infer<typeof CoursesSchema>) {
    let count = 0;
    const docs: CourseDocument[] = [];
    for (const course of courses) {
      if (course.state !== "ESTABLISHED") continue;
      count++;
      if (count % 10 === 0) {
        this.logger.log(`Processed ${count} courses so far`);
      }
      const plan = await this.kopps.getCourseInformation(course).catch((_e) => {
        return null;
      });
      const doc = plan
        ? this.toDocument(plan, course)
        : {
            course_name: course.name,
            course_code: course.code,
            department: course.department,
            state: course.state,
            goals: "",
            content: "",
            subject: "",
            periods: [],
            short_name: "",
            course_category: [],
          };
      docs.push(doc);
    }
    return docs;
  }

  // runs a small test of the neon ingestion with the first 10 established courses
  async runNeonTest() {
    this.logger.log("Starting Neon test process...");
    try {
      const courses = await this.kopps.getCourses();
      const sample = courses
        .filter((c) => c.state === "ESTABLISHED")
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
      this.logger.log(`Sampled ${sample.length} courses`);

      const {
        courses: converted,
        rounds,
        examinations,
      } = await this.convertCourses(sample);
      this.logger.log(
        `Converted ${converted.length} courses with ${rounds.length} rounds and ${examinations.length} examination components`,
      );

      await this.upsertCourses(converted);
      await this.upsertRounds(rounds);
      await this.upsertExaminations(examinations);
      this.logger.log("Neon test process completed successfully");
    } catch (error) {
      this.logger.error("Neon test process failed:", error);
      throw error;
    }
  }

  // runs a test for the elastic ingestion
  async runElasticTest() {
    this.logger.log("Starting elastic test process");
    try {
      this.logger.log("Fetching courses from KTH API...");
      const courses = await this.kopps.getCourses();
      this.logger.log(`Fetched ${courses.length} courses`);

      this.logger.log("Getting a single document for Elasticsearch...");
      const candidate =
        courses.find((c) => c.state === "ESTABLISHED") ?? courses[0];
      const docs = await this.getBulkDocs(candidate ? [candidate] : []);
      this.logger.log(`Prepared ${docs.length} document for indexing`);

      this.logger.log("Indexing documents to Elasticsearch...");
      await this.indexBulk(docs);
      this.logger.log("Elastic test process completed successfully");
    } catch (error) {
      this.logger.error("Elastic test process failed:", error);
      throw error;
    }
  }
}
