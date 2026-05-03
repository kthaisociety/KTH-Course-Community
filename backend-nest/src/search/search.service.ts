import type { Client as ESClient, estypes } from "@elastic/elasticsearch";
import { Inject, Injectable } from "@nestjs/common";
import { inArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
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
  constructor(
    @Inject(ES) private readonly es: ESClient | null,
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
    private readonly courseService: CourseService,
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
    const queryUpper = query.toUpperCase();
    const fetchSize = hasMinRatingFilter ? size * 5 : size;
    const textPattern = `%${query}%`;
    const codePrefix = `${queryUpper}%`;
    const codeContains = `%${queryUpper}%`;

    const conditions = [
      sql`(
        code ILIKE ${codePrefix}
        OR code ILIKE ${codeContains}
        OR name_swedish ILIKE ${textPattern}
        OR name_english ILIKE ${textPattern}
        OR goals ILIKE ${textPattern}
        OR content ILIKE ${textPattern}
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
          ELSE 2
        END,
        code ASC
      LIMIT ${fetchSize}
    `);

    return (result.rows as Array<{ code: string }>).map((r) => ({
      courseCode: r.code,
      score: null,
    }));
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
      ranked = await this.searchWithDatabase(
        query,
        size,
        departmentFilter,
        hasMinRatingFilter,
      );
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
