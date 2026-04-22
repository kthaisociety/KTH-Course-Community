import type { Client as ESClient, estypes } from "@elastic/elasticsearch";
import { Inject, Injectable } from "@nestjs/common";
import type { CourseSummary } from "@shared/types";
import { inArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { CourseService } from "../course/course.service";
import { DRIZZLE } from "../db/drizzle.module";
import * as schema from "../db/schema";
import { ES } from "./search.constants";

const INDEX = "courses";

export interface SearchHit {
  courseCode: string;
  score: number | null;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(ES) private readonly es: ESClient,
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
    private readonly courseService: CourseService,
  ) {}

  async searchCourses(
    query: string,
    size = 10,
    filters?: { department?: string; minRating?: number },
  ): Promise<CourseSummary[]> {
    if (!query?.trim()) return [];

    // constructs the filter
    const searchFilters: estypes.QueryDslQueryContainer[] = [];
    if (filters?.department) {
      const dept = filters.department;
      const departments = ["EECS", "ABE", "CBH", "ITM", "SCI"]; // TODO: Why hardcoded?
      const matchingDepts = departments.find((abbr) => dept.includes(abbr));
      if (matchingDepts) {
        searchFilters.push({
          wildcard: { department: `*${matchingDepts}*` },
        } as estypes.QueryDslQueryContainer);
      } else {
        searchFilters.push({
          term: { department: dept },
        } as estypes.QueryDslQueryContainer);
      }
    }

    // search results for the user query
    const res = await this.es.search<unknown>({
      index: INDEX,
      // over-fetch when rating filter is active so we can filter client-side
      size: filters?.minRating ? size * 5 : size,
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

    //
    const hits = (res.hits?.hits ?? []) as Array<{
      _score: number | null;
      _source?: { course_code?: string };
    }>;
    const ranked: SearchHit[] = hits
      .map((h) => ({
        courseCode: h._source?.course_code ?? "",
        score: h._score,
      }))
      .filter((h) => h.courseCode.length > 0);

    if (ranked.length === 0) return [];

    let codes = ranked.map((h) => h.courseCode);

    const minRating = filters?.minRating;
    if (minRating) {
      const ratingRows = await this.db.execute(
        sql`SELECT course_code,
            ROUND((AVG(easy_score) + AVG(useful_score) + AVG(interesting_score))/3) AS rating
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
