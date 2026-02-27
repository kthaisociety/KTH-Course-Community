import type { Client as ESClient } from "@elastic/elasticsearch";
import { HttpService } from "@nestjs/axios";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { firstValueFrom } from "rxjs";
import {
  courses as coursesTable,
  type InsertCourse,
} from "../../../types/database/schema";
import {
  CourseDetailSchema,
  CourseSchema,
  CoursesSchema,
  type Document,
} from "../../../types/ingest/schemas";
import { DRIZZLE } from "../database/drizzle.module";
import { ES } from "../search/search.constants.js";

const INDEX = "courses";

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

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

  constructor(
    private readonly http: HttpService,
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase,
    @Inject(ES) private readonly es: ESClient,
  ) {}

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
      const courses = await this.getCourses();
      this.logger.log(`Fetched ${courses.length} courses`);

      this.logger.log("Converting courses...");
      const converted = this.convertCourses(courses as InsertCourse[]);

      this.logger.log("Upserting courses to database...");
      await this.upsertCourses(converted);
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
      const courses = await this.getCourses();
      this.logger.log(`Fetched ${courses.length} courses`);

      this.logger.log("Converting courses...");
      const converted = this.convertCourses(courses as InsertCourse[]);

      this.logger.log("Getting bulk documents for Elasticsearch...");
      const docs = await this.getBulkDocs(converted);
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

  getIngestStatus() {
    return {
      neon: { ...this.status.neon },
      elastic: { ...this.status.elastic },
    };
  }

  // fetches list of courses from API --> filter result by CourseSchema
  private async getCourses() {
    const endpoint = "https://api.kth.se/api/kopps/v2/courses?l=en";
    const { data } = await firstValueFrom(this.http.get(endpoint));
    return CoursesSchema.parse(data);
  }

  // converts courses to fit db schema
  private convertCourses(
    courses: z.infer<typeof CoursesSchema>,
  ): InsertCourse[] {
    return courses.map((course) => ({
      code: course.code,
      department: course.department,
      name: course.name,
      state: course.state,
      lastExaminationSemester: course.last_examination_semester,
    })) as InsertCourse[];
  }

  // fetches the detailed course info from API --> filter result by CourseSchema
  private async getCourseInformation(course: z.infer<typeof CourseSchema>) {
    const endpoint = `https://api.kth.se/api/kopps/v2/course/${course.code}/detailedinformation`;
    await new Promise((r) => setTimeout(r, 200));
    const { data } = await firstValueFrom(this.http.get(endpoint));
    return CourseDetailSchema.parse(data);
  }

  // inserts courses into db
  private async upsertCourses(courses: InsertCourse[]) {
    const chunkSize = 1000;
    for (let i = 0; i < courses.length; i += chunkSize) {
      const chunk = courses.slice(i, i + chunkSize);
      await this.db
        .insert(coursesTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: coursesTable.code,
          set: {
            department: sql`excluded.department`,
            name: sql`excluded.name`,
            state: sql`excluded.state`,
            lastExaminationSemester: sql`excluded.last_examination_semester`,
            updatedAt: sql`now()`,
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

  private async getBulkDocs(courses: InsertCourse[]) {
    let count = 0;
    const docs: Document[] = [];
    for (const course of courses) {
      if (course.state !== "ESTABLISHED") continue;
      count++;
      if (count % 10 === 0) {
        this.logger.log(`Processed ${count} courses so far`);
      }
      const plan = await this.getCourseInformation(course).catch((_e) => {
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
      const courses = await this.getCourses();
      this.logger.log(`Fetched ${courses.length} courses`);

      this.logger.log("Converting courses...");
      const converted = this.convertCourses(courses as InsertCourse[]);

      this.logger.log("Getting a single document for Elasticsearch...");
      const firstEstablished = converted.find((c) => c.state === "ESTABLISHED");
      const candidate = firstEstablished ?? converted[0];
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
