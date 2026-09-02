import type { CourseSummary } from "@/types";
import { inArray, sql } from "drizzle-orm";
import { embedSingle } from "./ai";
import { getSummariesByCodes } from "./course";
import type { Database } from "./db";
import * as schema from "./db/schema";

export interface SearchHit {
  courseCode: string;
  score: number | null;
}

const embeddingCache = new Map<string, number[]>();
const embeddingInflight = new Map<string, Promise<number[]>>();
let embeddingSearchFailures = 0;

function resolveDepartmentFilter(department?: string): string | null {
  if (!department) return null;
  const departments = ["EECS", "ABE", "CBH", "ITM", "SCI"];
  const matchingDepts = departments.find((abbr) => department.includes(abbr));
  return matchingDepts ?? department;
}

async function searchWithDatabase(
  db: Database,
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
  const result = await db.execute(sql`
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

async function searchWithEmbedding(
  db: Database,
  query: string,
  limit: number,
  departmentFilter: string | null,
): Promise<SearchHit[]> {
  try {
    const cacheKey = query.trim().toLowerCase();

    let embedding: number[] | undefined = embeddingCache.get(cacheKey);
    if (!embedding) {
      let pending = embeddingInflight.get(cacheKey);
      if (!pending) {
        let settle!: (v: number[]) => void;
        let fail!: (e: unknown) => void;
        pending = new Promise<number[]>((resolve, reject) => {
          settle = resolve;
          fail = reject;
        });
        embeddingInflight.set(cacheKey, pending);
        void pending
          .finally(() => {
            embeddingInflight.delete(cacheKey);
          })
          .catch(() => {});
        void embedSingle(query).then(
          ({ embedding: fresh }) => {
            try {
              if (embeddingCache.size >= 500) {
                const firstKey = embeddingCache.keys().next().value;
                if (firstKey !== undefined) {
                  embeddingCache.delete(firstKey);
                }
              }
              embeddingCache.set(cacheKey, fresh);
              settle(fresh);
            } catch (e: unknown) {
              fail(e);
            }
          },
          (err: unknown) => {
            embeddingSearchFailures += 1;
            const detail = err instanceof Error ? err.message : String(err);
            console.warn(
              `Embedding search failed, returning []. (failure #${embeddingSearchFailures}) ${detail}`,
            );
            fail(err);
          },
        );
      }
      try {
        embedding = await pending;
      } catch {
        return [];
      }
    }

    const vectorLiteral = JSON.stringify(embedding);

    const conditions = [sql`embedding IS NOT NULL`];
    if (departmentFilter) {
      conditions.push(sql`department ILIKE ${`%${departmentFilter}%`}`);
    }
    const whereSql = sql.join(conditions, sql` AND `);

    const result = await db.execute(sql`
        WITH q AS (SELECT ${vectorLiteral}::vector AS v)
        SELECT code, 1 - (embedding <=> q.v) AS score
        FROM ${schema.courses}, q
        WHERE ${whereSql}
        ORDER BY embedding <=> q.v
        LIMIT ${limit}
      `);

    return (result.rows as Array<{ code: string; score: number }>).map((r) => ({
      courseCode: r.code,
      score: r.score,
    }));
  } catch (err) {
    embeddingSearchFailures += 1;
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(
      `Embedding search failed, returning []. (failure #${embeddingSearchFailures}) ${detail}`,
    );
    return [];
  }
}

export async function searchCourses(
  db: Database,
  query: string,
  size = 10,
  filters?: { department?: string; minRating?: number },
): Promise<CourseSummary[]> {
  if (!query?.trim()) return [];
  const departmentFilter = resolveDepartmentFilter(filters?.department);
  const hasMinRatingFilter = Boolean(filters?.minRating);

  const fetchSize = hasMinRatingFilter ? size * 5 : size;
  const [keywordHits, semanticHits] = await Promise.all([
    searchWithDatabase(db, query, size, departmentFilter, hasMinRatingFilter),
    searchWithEmbedding(db, query, fetchSize, departmentFilter),
  ]);

  const seen = new Set(keywordHits.map((h) => h.courseCode));
  const ranked = [
    ...keywordHits,
    ...semanticHits.filter((h) => !seen.has(h.courseCode)),
  ].slice(0, fetchSize);

  if (ranked.length === 0) return [];

  let codes = ranked.map((h) => h.courseCode);

  const minRating = filters?.minRating;
  if (minRating) {
    const ratingRows = await db.execute(
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

  return getSummariesByCodes(db, codes);
}

export async function getDepartments(db: Database): Promise<string[]> {
  const result = await db.execute(
    sql`SELECT DISTINCT department FROM ${schema.courses} ORDER BY department ASC`,
  );
  return result.rows.map((r) => r.department as string);
}
