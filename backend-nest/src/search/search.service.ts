import type { Client as ESClient, estypes } from "@elastic/elasticsearch";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { inArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { AiService } from "../ai/ai.service";
import { CourseService } from "../course/course.service";
import { DRIZZLE } from "../db/drizzle.module";
import * as schema from "../db/schema";
import type { CourseSummary } from "../types/course.types";
import { ES } from "./search.constants";

const INDEX = "courses";

export interface SearchHit {
  courseCode: string;
  score: number | null;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly embeddingCache = new Map<string, number[]>();
  private readonly embeddingInflight = new Map<string, Promise<number[]>>();
  private embeddingSearchFailures = 0;

  constructor(
    @Inject(ES) private readonly es: ESClient | null,
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
    private readonly courseService: CourseService,
    private readonly aiService: AiService,
  ) {}

  private resolveDepartmentFilter(department?: string): string | null {
    if (!department) return null;
    const departments = ["EECS", "ABE", "CBH", "ITM", "SCI"];
    const matchingDepts = departments.find((abbr) => department.includes(abbr));
    return matchingDepts ?? department;
  }

  private async searchWithDatabase(
    query: string,
    size: number,
    departmentFilter: string | null,
    hasMinRatingFilter: boolean,
  ): Promise<SearchHit[]> {
    const normalizedQuery = query.trim();
    const queryUpper = normalizedQuery.toUpperCase();
    const fetchSize = hasMinRatingFilter ? size * 5 : size;
    const textPattern = `%${normalizedQuery}%`;
    const codePrefix = `${queryUpper}%`;
    const codeContains = `%${queryUpper}%`;

    const conditions = [
      sql`(
        code ILIKE ${codePrefix}
        OR code ILIKE ${codeContains}
        OR name_swedish ILIKE ${textPattern}
        OR name_english ILIKE ${textPattern}
        OR (
          ${normalizedQuery} <> ''
          AND search_vector @@ plainto_tsquery('simple', ${normalizedQuery})
        )
      )`,
    ];
    if (departmentFilter) {
      conditions.push(sql`department ILIKE ${`%${departmentFilter}%`}`);
    }

    const whereSql = sql.join(conditions, sql` AND `);
    const result = await this.db.execute(sql`
      SELECT code
      FROM ${schema.courses}
      WHERE ${whereSql}
      ORDER BY
        CASE
          WHEN code ILIKE ${codePrefix} THEN 0
          WHEN code ILIKE ${codeContains} THEN 1
          WHEN (
            ${normalizedQuery} <> ''
            AND search_vector @@ plainto_tsquery('simple', ${normalizedQuery})
          ) THEN 2
          ELSE 3
        END,
        CASE
          WHEN (
            ${normalizedQuery} <> ''
            AND search_vector @@ plainto_tsquery('simple', ${normalizedQuery})
          )
            THEN ts_rank(search_vector, plainto_tsquery('simple', ${normalizedQuery}))
          ELSE 0
        END DESC,
        code ASC
      LIMIT ${fetchSize}
    `);

    return (result.rows as Array<{ code: string }>).map((r) => ({
      courseCode: r.code,
      score: null,
    }));
  }

  private async searchWithEmbedding(
    query: string,
    limit: number,
    departmentFilter: string | null,
  ): Promise<SearchHit[]> {
    try {
      const cacheKey = query.trim().toLowerCase();

      let embedding = this.embeddingCache.get(cacheKey);
      if (!embedding) {
        let pending = this.embeddingInflight.get(cacheKey);
        if (!pending) {
          let settle!: (v: number[]) => void;
          let fail!: (e: unknown) => void;
          pending = new Promise<number[]>((resolve, reject) => {
            settle = resolve;
            fail = reject;
          });
          this.embeddingInflight.set(cacheKey, pending);
          void pending.finally(() => {
            this.embeddingInflight.delete(cacheKey);
          });
          void this.aiService
            .embedSingle(query)
            .then(({ embedding: fresh }) => {
              if (this.embeddingCache.size >= 500) {
                const firstKey = this.embeddingCache.keys().next().value;
                if (firstKey !== undefined) {
                  this.embeddingCache.delete(firstKey);
                }
              }
              this.embeddingCache.set(cacheKey, fresh);
              settle(fresh);
            }, fail);
        }
        embedding = await pending;
      }

      const vectorLiteral = JSON.stringify(embedding);

      const conditions = [sql`embedding IS NOT NULL`];
      if (departmentFilter) {
        conditions.push(sql`department ILIKE ${`%${departmentFilter}%`}`);
      }
      const whereSql = sql.join(conditions, sql` AND `);

      const result = await this.db.execute(sql`
        WITH q AS (SELECT ${vectorLiteral}::vector AS v)
        SELECT code, 1 - (embedding <=> q.v) AS score
        FROM ${schema.courses}, q
        WHERE ${whereSql}
        ORDER BY embedding <=> q.v
        LIMIT ${limit}
      `);

      return (result.rows as Array<{ code: string; score: number }>).map(
        (r) => ({
          courseCode: r.code,
          score: r.score,
        }),
      );
    } catch (err) {
      this.embeddingSearchFailures += 1;
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Embedding search failed, returning []. (failure #${this.embeddingSearchFailures}) ${detail}`,
      );
      return [];
    }
  }

  async searchCourses(
    query: string,
    size = 10,
    filters?: { department?: string; minRating?: number },
  ): Promise<CourseSummary[]> {
    if (!query?.trim()) return [];
    const departmentFilter = this.resolveDepartmentFilter(filters?.department);
    const hasMinRatingFilter = Boolean(filters?.minRating);

    let ranked: SearchHit[] = [];
    if (this.es) {
      // constructs the filter
      const searchFilters: estypes.QueryDslQueryContainer[] = [];
      if (departmentFilter) {
        searchFilters.push({
          wildcard: { department: `*${departmentFilter}*` },
        } as estypes.QueryDslQueryContainer);
      }

      // search results for the user query
      const res = await this.es.search<unknown>({
        index: INDEX,
        // over-fetch when rating filter is active so we can filter client-side
        size: hasMinRatingFilter ? size * 5 : size,
        query: {
          bool: {
            should: [
              { prefix: { course_code: query.toUpperCase() } },
              { wildcard: { course_code: `*${query.toUpperCase()}*` } },
              {
                multi_match: {
                  query,
                  fields: ["course_name_swe^2", "course_name_eng^2"],
                  type: "phrase_prefix",
                },
              },
              {
                multi_match: {
                  query,
                  fields: [
                    "course_name_swe^2",
                    "course_name_eng^2",
                    "course_code^2",
                    "department",
                    "subject",
                    "periods",
                    "course_category",
                    "state",
                    "credits",
                    "goals",
                    "content",
                    "eligibility",
                  ],
                  fuzziness: "AUTO",
                  type: "best_fields",
                  lenient: true,
                },
              },
            ],
            minimum_should_match: 1,
            filter: searchFilters,
          },
        },
        _source: ["course_code"],
      });

      const hits = (res.hits?.hits ?? []) as Array<{
        _score: number | null;
        _source?: { course_code?: string };
      }>;
      ranked = hits
        .map((h) => ({
          courseCode: h._source?.course_code ?? "",
          score: h._score,
        }))
        .filter((h) => h.courseCode.length > 0);
    } else {
      const fetchSize = hasMinRatingFilter ? size * 5 : size;
      const [keywordHits, semanticHits] = await Promise.all([
        this.searchWithDatabase(
          query,
          size,
          departmentFilter,
          hasMinRatingFilter,
        ),
        this.searchWithEmbedding(query, fetchSize, departmentFilter),
      ]);

      const seen = new Set(keywordHits.map((h) => h.courseCode));
      const merged = [
        ...keywordHits,
        ...semanticHits.filter((h) => !seen.has(h.courseCode)),
      ];
      ranked = merged.slice(0, fetchSize);
    }

    if (ranked.length === 0) return [];

    let codes = ranked.map((h) => h.courseCode);

    const minRating = filters?.minRating;
    if (minRating) {
      const ratingRows = await this.db.execute(
        sql`SELECT course_code,
            ROUND((AVG(examination_methods) + AVG(theoretical_vs_applied) + AVG(workload) + AVG(learning_experience))/4) AS rating
            FROM ${schema.reviews}
            WHERE ${inArray(schema.reviews.courseCode, codes)}
            GROUP BY course_code`,
      );
      const rows = ratingRows.rows as Array<{
        course_code: string;
        rating: number;
      }>;
      const ratingByCode = new Map(
        rows.map((r) => [r.course_code, Number(r.rating) || 0]),
      );
      codes = codes.filter((c) => (ratingByCode.get(c) ?? 0) >= minRating);
    }

    codes = codes.slice(0, size);

    // final step is to call the course service, to turn the courses into CoruseSummary objects
    return this.courseService.getSummariesByCodes(codes);
  }
}
