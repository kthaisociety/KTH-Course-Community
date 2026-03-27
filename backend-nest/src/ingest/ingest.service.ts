import type { Client as ESClient } from '@elastic/elasticsearch';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { inArray, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { z } from 'zod';
import {
  courseExaminations as courseExaminationsTable,
  courseRounds as courseRoundsTable,
  courses as coursesTable,
  type InsertCourse,
  type InsertCourseExamination,
  type InsertCourseRound,
} from '../../../types/database/schema';
import {
  CourseDetailSchema,
  CourseSchema,
  CoursesSchema,
} from '../../../types/ingest/schemas';
import type { CourseDocumentES } from '../../../types/search/elastic.mappings';
import { DRIZZLE } from '../database/drizzle.module';
import { ES } from '../search/search.constants.js';
import { KoppsService } from './kopps.service';

const INDEX = 'courses';

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

  private getKoppsConcurrency() {
    const raw = process.env.KOPPS_CONCURRENCY;
    const parsed = raw ? Number(raw) : 5;
    if (!Number.isFinite(parsed) || parsed <= 0) return 5;
    return Math.floor(parsed);
  }

  private async mapWithConcurrency<T, R>(
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

  // runs the ingestion pipeline --> inserts into SQL tables (Neon) and ElasticSearch.
  async runFullIngest() {
    this.logger.log('Starting full ingest process...');
    this.logger.log('Fetching courses from KTH API (once for full ingest)...');
    const courses = await this.kopps.getCourses();
    await this.runNeonIngest(courses);
    await this.runElasticIngest(courses);
  }

  // ingests courses into neon db
  async runNeonIngest(coursesInput?: z.infer<typeof CoursesSchema>) {
    if (this.status.neon.running) {
      this.logger.warn('Neon ingestion already running; skipping new request');
      return;
    }
    this.status.neon.running = true;
    this.status.neon.lastStarted = new Date();
    this.status.neon.lastError = null;
    this.logger.log('Neon ingestion process started...');
    try {
      const courses = coursesInput ?? (await this.kopps.getCourses());
      const establishedCourses = courses.filter(
        (course) => course.state === 'ESTABLISHED',
      );
      this.logger.log(
        `Fetched ${courses.length} courses. Filtered to ${establishedCourses.length} established courses.`,
      );

      this.logger.log(`Converting ${establishedCourses.length} courses...`);
      const {
        courses: converted,
        rounds,
        examinations,
      } = await this.convertCourses(establishedCourses);
      this.logger.log(
        `Converted ${converted.length} courses with ${rounds.length} rounds and ${examinations.length} examination components`,
      );

      this.logger.log('Upserting courses to database...');
      await this.upsertCourses(converted);
      await this.upsertRounds(rounds);
      await this.upsertExaminations(examinations);
      this.status.neon.lastCompleted = new Date();
      this.logger.log('Courses upserted successfully');
    } catch (error) {
      this.status.neon.lastError = String(error);
      this.logger.error('Neon ingest process failed:', error);
      throw error;
    } finally {
      this.status.neon.running = false;
    }
  }

  // ingests into elastic db
  async runElasticIngest(coursesInput?: z.infer<typeof CoursesSchema>) {
    if (this.status.elastic.running) {
      this.logger.warn(
        'Elastic ingestion already running; skipping new request',
      );
      return;
    }
    this.status.elastic.running = true;
    this.status.elastic.lastStarted = new Date();
    this.status.elastic.lastError = null;
    this.logger.log('Elastic ingestion process started...');
    try {
      const courses = coursesInput ?? (await this.kopps.getCourses());
      const establishedCourses = courses.filter(
        (course) => course.state === 'ESTABLISHED',
      );
      this.logger.log(
        `Fetched ${courses.length} courses. Filtered to ${establishedCourses.length} established courses.`,
      );
      this.logger.log(
        `Starting ingest of ${establishedCourses.length} courses (established only)...`,
      );

      this.logger.log('Getting bulk documents for Elasticsearch...');
      const docs = await this.getBulkDocs(establishedCourses);

      this.logger.log(`Prepared ${docs.length} documents for indexing`);
      this.logger.log('Indexing documents to Elasticsearch...');
      await this.indexBulk(docs);
      this.status.elastic.lastCompleted = new Date();

      this.logger.log('Elastic ingest process completed successfully');
    } catch (error) {
      this.status.elastic.lastError = String(error);
      this.logger.error('Elastic ingest process failed:', error);
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
    const concurrency = this.getKoppsConcurrency();
    let processed = 0;
    const results = await this.mapWithConcurrency(
      courses,
      concurrency,
      async (course) => {
        processed += 1;
        if (processed % 25 === 0) {
          this.logger.log(
            `Neon convertCourses: processed ${processed}/${courses.length}`,
          );
        }

        const detail = await this.kopps
          .getCourseInformation(course)
          .catch(() => null);
        if (!detail) return null;

        // API returns all historic syllabuses in an array, this fetches just the latest
        const latest = detail.publicSyllabusVersions.reduce(
          (a, b) => (b.validFromTerm.term > a.validFromTerm.term ? b : a),
          detail.publicSyllabusVersions[0],
        );

        const insertCourse: InsertCourse = {
          code: detail.course.courseCode,
          name: detail.course.titleOther,
          titleSwe: detail.course.title,
          titleEng: detail.course.titleOther,
          state: course.state,
          credits: detail.course.credits,
          creditUnit: detail.course.creditUnitAbbr,
          departmentCode: detail.course.departmentCode,
          department: detail.course.department.name,
          educationalLevelCode: detail.course.educationalLevelCode,
          gradeScaleCode: detail.course.gradeScaleCode,
          goals: latest?.courseSyllabus.goals ?? '',
          content: latest?.courseSyllabus.content ?? '',
          eligibility: latest?.courseSyllabus.eligibility ?? '',
        };

        const insertRounds: InsertCourseRound[] = detail.roundInfos.map(
          (r) => ({
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
          }),
        );

        // examinationSets are historical sets of examination. The latest one is the current set.
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

  // inserts round infos to database, delete existing rounds per course, then insert fresh
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

  // maps detailed course data to an ES document
  private toDocument(
    courses: z.infer<typeof CourseDetailSchema>,
    course: z.infer<typeof CourseSchema>,
  ): CourseDocumentES {
    // pick the latest syllabus version by term
    const syllabus_latest = courses.publicSyllabusVersions.reduce(
      (a, b) => (b.validFromTerm.term > a.validFromTerm.term ? b : a),
      courses.publicSyllabusVersions[0],
    );
    const course_categories = new Set<'OPEN COURSE' | 'PROGRAMME COURSE'>();
    for (const r of courses.roundInfos) {
      if (r.round.isVU) course_categories.add('OPEN COURSE');
      if (r.round.isPU) course_categories.add('PROGRAMME COURSE');
    }
    return {
      course_code: course.code,
      course_name_swe: courses.course.title,
      course_name_eng: courses.course.titleOther,
      department: course.department,
      credits: courses.course.credits,
      subject: courses.mainSubjects[0] ?? '',
      // flatMap: courseRoundTerms is an array per round, so map would give string[][]
      // extract just the period e.g. "P3" from "P3 (7,5 hp)"
      periods: [
        ...new Set(
          courses.roundInfos
            .flatMap((r) => r.round.courseRoundTerms ?? [])
            .map((t) => t.formattedPeriodsAndCredits?.match(/^(P\d+)/)?.[1])
            .filter((p): p is string => p !== undefined),
        ),
      ],
      course_category: [...course_categories],
      goals: syllabus_latest?.courseSyllabus.goals ?? '',
      content: syllabus_latest?.courseSyllabus.content ?? '',
      eligibility: syllabus_latest?.courseSyllabus.eligibility ?? '',
      state: course.state,
    };
  }

  //
  private async ensureIndex() {
    try {
      await this.es.indices.create({
        index: INDEX,
        settings: { number_of_shards: 1, number_of_replicas: 1 },
        mappings: {
          dynamic: 'strict',
          properties: {
            course_code: { type: 'keyword' },
            course_name_swe: {
              type: 'text',
              fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            course_name_eng: {
              type: 'text',
              fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            department: { type: 'keyword' },
            credits: { type: 'float' },
            subject: { type: 'keyword' },
            periods: { type: 'keyword' },
            course_category: { type: 'keyword' },
            goals: { type: 'text' },
            content: { type: 'text' },
            eligibility: { type: 'text' },
            state: { type: 'keyword' },
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
      if (status === 400 && type === 'resource_already_exists_exception')
        return;
      if (status === 403) {
        this.logger.error(`403 creating index "${INDEX}". Check privileges.`);
      }
      throw e;
    }
  }

  private docsToBulkOperations(docs: CourseDocumentES[]) {
    type IndexOp = { index: { _index: string; _id: string } };
    const ops: Array<IndexOp | CourseDocumentES> = [];
    for (const d of docs) {
      ops.push({ index: { _index: INDEX, _id: d.course_code } });
      ops.push(d);
    }
    return ops;
  }

  private async indexBulk(docs: CourseDocumentES[]) {
    if (!docs.length) {
      this.logger.warn('No course documents to index; skipping bulk request');
      return;
    }
    await this.ensureIndex();
    const operations = this.docsToBulkOperations(docs);
    const res = await this.es.bulk({ refresh: 'true', operations });

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
      .join('; ');
    throw new Error(
      `Bulk indexing failed for ${failures.length}/${res.items.length} items: ${summary}`,
    );
  }

  private async getBulkDocs(courses: z.infer<typeof CoursesSchema>) {
    let count = 0;
    const docs: CourseDocumentES[] = [];
    for (const course of courses) {
      if (course.state !== 'ESTABLISHED') continue;
      count++;
      if (count % 10 === 0) {
        this.logger.log(`Processed ${count} courses so far`);
      }
      const plan = await this.kopps.getCourseInformation(course).catch((e) => {
        this.logger.error(
          `Failed to get course information for ${course.code}: ${e}`,
        );
        return null;
      });
      const doc = plan
        ? this.toDocument(plan, course)
        : {
            course_code: course.code,
            course_name_swe: course.name,
            course_name_eng: course.name,
            department: course.department,
            credits: 0,
            subject: '',
            periods: [],
            course_category: [] as CourseDocumentES['course_category'],
            goals: '',
            content: '',
            eligibility: '',
            state: course.state,
          };
      docs.push(doc);
    }
    return docs;
  }

  // runs a small test of the neon ingestion with the first 10 established courses
  async runNeonTest() {
    this.logger.log('Starting Neon test process...');
    try {
      const courses = await this.kopps.getCourses();
      const sample = courses
        .filter((c) => c.state === 'ESTABLISHED')
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
      this.logger.log('Neon test process completed successfully');
    } catch (error) {
      this.logger.error('Neon test process failed:', error);
      throw error;
    }
  }

  // runs a test for the elastic ingestion with 10 courses
  async runElasticTest() {
    this.logger.log('Starting elastic test process');
    try {
      this.logger.log('Fetching courses from KTH API...');
      const courses = await this.kopps.getCourses();
      this.logger.log(`Fetched ${courses.length} courses`);

      this.logger.log('Getting 10 documents for Elasticsearch...');
      const candidates = courses
        .filter((c) => c.state === 'ESTABLISHED')
        .slice(0, 10);
      const docs = await this.getBulkDocs(candidates);
      this.logger.log(`Prepared ${docs.length} document for indexing`);

      this.logger.log('Indexing documents to Elasticsearch...');
      await this.indexBulk(docs);
      this.logger.log('Elastic test process completed successfully');
    } catch (error) {
      this.logger.error('Elastic test process failed:', error);
      throw error;
    }
  }
}
