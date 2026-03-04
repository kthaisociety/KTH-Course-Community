import type { Client as ESClient } from "@elastic/elasticsearch";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { z } from "zod";
import {
  courseRounds as courseRoundsTable,
  courses as coursesTable,
  type InsertCourse,
  type InsertCourseRound,
} from "../../../types/database/schema";
import {
  CourseDetailSchema,
  CourseSchema,
  CoursesSchema,
  type Document,
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
      this.logger.log(`Fetched ${courses.length} courses`);

      this.logger.log("Converting courses...");
      const { courses: converted, rounds } = await this.convertCourses(courses);
      this.logger.log(
        `Converted ${converted.length} courses with ${rounds.length} rounds`,
      );

      this.logger.log("Upserting courses to database...");
      await this.upsertCourses(converted);
      await this.upsertRounds(rounds);
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

      // TODO: Need to convert API detailed info to Elastic Document as well
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
    Converts courses to fit db schema, fetches detail for each course. 
    Also maps to course rounds directly --> courses can have different rounds. 
    E.g. DD2421 is offered in both P1 and P3. 
  */
  private async convertCourses(
    courses: z.infer<typeof CoursesSchema>,
  ): Promise<{ courses: InsertCourse[]; rounds: InsertCourseRound[] }> {
    const results = await Promise.all(
      courses.map(async (course) => {
        // TODO: Rename from "detail" to like "courses" for clarity?
        const detail = await this.kopps
          .getCourseInformation(course)
          .catch(() => null);
        if (!detail) return null;

        // TODO: Clarify
        const latest = detail.publicSyllabusVersions.reduce(
          (a, b) => (b.validFromTerm.term > a.validFromTerm.term ? b : a),
          detail.publicSyllabusVersions[0],
        );

        const insertCourse: InsertCourse = {
          code: detail.course.courseCode,
          name: detail.course.titleOther,
          titleSwedish: detail.course.title,
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
        };

        const insertRounds: InsertCourseRound[] = detail.roundInfos
          .filter((r) => r.round.shortName)
          .map((r) => ({
            shortName: r.round.shortName!,
            courseCode: detail.course.courseCode,
            startTerm: r.startTerm.term,
            startWeekYear: r.startWeek?.year ?? null,
            startWeek: r.startWeek?.week ?? null,
            endWeekYear: r.endWeek?.year ?? null,
            endWeek: r.endWeek?.week ?? null,
            studyPace: r.studyPace ?? null,
            lectureCount: r.lectureCount ?? null,
            schemaUrl: r.schemaUrl ?? null,
            language: r.round.language ?? null,
            tutoringForm: r.round.tutoringForm?.name ?? null,
            tutoringTimeOfDay: r.round.tutoringTimeOfDay?.name ?? null,
            formattedPeriodsAndCredits:
              r.round.courseRoundTerms?.[0]?.formattedPeriodsAndCredits ?? null,
            isPU: r.isPU,
            isVU: r.isVU,
          }));

        return { course: insertCourse, rounds: insertRounds };
      }),
    );

    const valid = results.filter((r) => r !== null);
    return {
      courses: valid.map((r) => r.course),
      rounds: valid.flatMap((r) => r.rounds),
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
            titleSwedish: sql`excluded.name_swedish`,
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
            updatedAt: sql`now()`,
          },
        });
    }
  }

  // inserts round infos to database
  private async upsertRounds(rounds: InsertCourseRound[]) {
    const chunkSize = 1000;
    for (let i = 0; i < rounds.length; i += chunkSize) {
      const chunk = rounds.slice(i, i + chunkSize);
      await this.db
        .insert(courseRoundsTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: courseRoundsTable.shortName,
          set: {
            startTerm: sql`excluded.start_term`,
            startWeekYear: sql`excluded.start_week_year`,
            startWeek: sql`excluded.start_week`,
            endWeekYear: sql`excluded.end_week_year`,
            endWeek: sql`excluded.end_week`,
            studyPace: sql`excluded.study_pace`,
            lectureCount: sql`excluded.lecture_count`,
            schemaUrl: sql`excluded.schema_url`,
            language: sql`excluded.language`,
            tutoringForm: sql`excluded.tutoring_form`,
            tutoringTimeOfDay: sql`excluded.tutoring_time_of_day`,
            formattedPeriodsAndCredits: sql`excluded.formatted_periods_and_credits`,
            isPU: sql`excluded.is_pu`,
            isVU: sql`excluded.is_vu`,
          },
        });
    }
  }

  // maps detailed course data to an ES document
  private toDocument(
    detail: z.infer<typeof CourseDetailSchema>,
    course: z.infer<typeof CourseSchema>,
  ): Document {
    // pick the latest syllabus version by term
    const latest = detail.publicSyllabusVersions.reduce(
      (a, b) => (b.validFromTerm.term > a.validFromTerm.term ? b : a),
      detail.publicSyllabusVersions[0],
    );
    return {
      course_name: course.name,
      course_code: course.code,
      department: course.department,
      state: course.state,
      goals: latest?.courseSyllabus.goals ?? "",
      content: latest?.courseSyllabus.content ?? "",
      subject: detail.mainSubjects[0] ?? "", // TODO: rename to just "subject". But need to double check if its always 1 subject or more
      // flatMap: courseRoundTerms is an array per round, so map would give string[][]
      periods: detail.roundInfos
        .flatMap((r) => r.round.courseRoundTerms ?? [])
        .map((t) => t.formattedPeriodsAndCredits ?? "")
        .filter(Boolean),
      short_name: detail.roundInfos[0]?.round.shortName ?? "",
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

  private docsToBulkOperations(docs: Document[]) {
    type IndexOp = { index: { _index: string; _id: string } };
    const ops: Array<IndexOp | Document> = [];
    for (const d of docs) {
      ops.push({ index: { _index: INDEX, _id: d.course_code } });
      ops.push(d);
    }
    return ops;
  }

  private async indexBulk(docs: Document[]) {
    if (!docs.length) {
      this.logger.warn("No documents to index; skipping bulk request");
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
    const docs: Document[] = [];
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
