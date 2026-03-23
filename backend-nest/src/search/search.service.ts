import type { Client as ESClient } from "@elastic/elasticsearch";
import { Inject, Injectable } from "@nestjs/common";
import { inArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../../../types/database/schema";
import type { CourseDocument } from "../../../types/search/elastic.mappings";
import { DRIZZLE } from "../database/drizzle.module";
import { ES } from "./search.constants";

const INDEX = "courses";

export type SearchResult = CourseDocument & {
  _id: string;
  _score: number | null;
  rating?: number;
};

// This simulates the 'Course' type defined in the frontend 'course_model'
export type ElasticCourse = CourseDocument & {
  _id: string;
  rating?: number;
};

@Injectable()
export class SearchService {
  constructor(
    @Inject(ES) private readonly es: ESClient,
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async searchCourses(
    query: string,
    size = 10,
    filters?: { department?: string; minRating?: number },
  ): Promise<SearchResult[]> {
    if (!query?.trim()) return [];
    const searchFilters: Array<{
      wildcard?: { department: string };
      term?: { department: string };
      range?: { averageRating: { gte: number } };
    }> = [];
    if (filters?.department) {
      const dept = filters.department;
      // console.log("Filtering by department:", JSON.stringify(dept));
      const departments = ["EECS", "ABE", "CBH", "ITM", "SCI"];
      const matchingDepts = departments.find((abbr) => dept.includes(abbr));
      if (matchingDepts) {
        const wildcardFilter = {
          wildcard: {
            department: `*${matchingDepts}*`,
          },
        };
        searchFilters.push(wildcardFilter);
      } else {
        const termFilter = {
          term: { department: dept },
        };
        searchFilters.push(termFilter);
      }
    }

    const res = await this.es.search<unknown, CourseDocument>({
      index: INDEX,
      size: filters?.minRating ? size * 5 : size, // get more results for rating filter
      query: {
        bool: {
          should: [
            { prefix: { course_code: query.toUpperCase() } }, // partial match for course code
            { wildcard: { course_code: `*${query.toUpperCase()}*` } }, // fallback
            {
              multi_match: {
                query,
                fields: ["course_name_swe^2", "course_name_eng^2"],
                type: "phrase_prefix", // partial words in names
              },
            },
            {
              multi_match: {
                query,
                fields: [
                  "course_name_swe^2",
                  "course_name_eng^2",
                  "course_code^2",
                  "goals",
                  "content",
                ],
                fuzziness: "AUTO",
                type: "best_fields",
              },
            },
          ],
          minimum_should_match: 1,
          filter: searchFilters,
        },
      },
      _source: [
        "course_code",
        "course_name_swe",
        "course_name_eng",
        "department",
        "credits",
        "goals",
        "content",
      ],
    });

    const hits = (res.hits?.hits ?? []) as Array<{
      _id: string;
      _score: number | null;
      _source?: CourseDocument;
    }>;

    const base = hits
      .filter((h) => Boolean(h._source))
      .map((h) => {
        const src = h._source ?? ({} as CourseDocument);
        return { ...src, _id: h._id, _score: h._score } as SearchResult;
      });

    // Add average rating from reviews
    const codes = base.map((c) => c.course_code);
    if (codes.length === 0) return base;

    const result = await this.db.execute(
      sql`SELECT course_code,
          ROUND((AVG(easy_score) + AVG(useful_score) + AVG(interesting_score))/3) AS rating
          FROM ${schema.reviews}
          WHERE ${inArray(schema.reviews.courseCode, codes)}
          GROUP BY course_code`,
    );

    const rows = result.rows as Array<{ course_code: string; rating: number }>;
    const codeToRating = new Map<string, number>();
    for (const r of rows) {
      codeToRating.set(r.course_code, Number(r.rating) || 0);
    }

    const resultsWithRatings = base.map((c) => ({
      ...c,
      rating: codeToRating.get(c.course_code) ?? 0,
    }));

    let filteredResults = resultsWithRatings;
    if (filters?.minRating) {
      filteredResults = resultsWithRatings.filter(
        (course) => course.rating >= filters.minRating!,
      );
    }
    return filteredResults.slice(0, size);
  }

  // Fetches a single course by code
  async getCourseByCode(
    courseCode: string,
  ): Promise<ElasticCourse | undefined> {
    // Fetching the basic course information from ES
    const res = await this.es.search<CourseDocument>({
      index: INDEX,
      size: 1,
      query: {
        term: {
          // makes a direct match to the course code
          course_code: courseCode,
        },
      },
    });
    const hits = res.hits?.hits ?? []; // fallback on [] which triggers a return of "undefined"
    // Fetching rating from NEON
    const ratingResult = await this.db.execute(
      sql`SELECT course_code,
          ROUND((AVG(easy_score) + AVG(useful_score) + AVG(interesting_score))/3) AS rating
          FROM ${schema.reviews}
          WHERE ${schema.reviews.courseCode} = ${courseCode}
          GROUP BY course_code`,
    );
    const rating = ratingResult.rows[0]?.rating;

    if (hits.length > 0) {
      return {
        ...hits[0]._source,
        _id: hits[0]._id,
        rating: rating,
      } as ElasticCourse;
    }
    return undefined;
  }
}
