import { sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";

export type SearchHit = {
  courseCode: string;
  score: number | null;
};

/**
 * `size` is the LIMIT, exactly. It used to be inflated to `size * 5` whenever a
 * minimum-rating filter was set, because the service thresholded ratings in
 * application code after the query and needed a window wide enough to survive
 * that pass. The rating filter is gone (it was in no artboard), so the window
 * has nothing to absorb: what is asked for is what is fetched. The department
 * filter needs no window at all — it is a SQL predicate below, so every row the
 * query returns already satisfies it.
 */
export async function searchByKeyword(
  query: string,
  size: number,
  departmentFilter: string | null,
): Promise<SearchHit[]> {
  const normalizedQuery = query.trim();
  const queryUpper = normalizedQuery.toUpperCase();
  const textPattern = `%${normalizedQuery}%`;
  const codePrefix = `${queryUpper}%`;
  const codeContains = `%${queryUpper}%`;

  const conditions = [
    sql`(
        ${schema.courses.code} ILIKE ${codePrefix}
        OR ${schema.courses.code} ILIKE ${codeContains}
        OR ${schema.courses.titleSwe} ILIKE ${textPattern}
        OR ${schema.courses.titleEng} ILIKE ${textPattern}
        OR (
          ${normalizedQuery} <> ''
          AND ${schema.courseExplore.searchVector} @@ plainto_tsquery('simple', ${normalizedQuery})
        )
      )`,
  ];
  if (departmentFilter) {
    conditions.push(
      sql`${schema.courses.department} ILIKE ${`%${departmentFilter}%`}`,
    );
  }

  const whereSql = sql.join(conditions, sql` AND `);
  const result = await db.execute(sql`
      SELECT ${schema.courses.code} AS code
      FROM ${schema.courses}
      LEFT JOIN ${schema.courseExplore}
        ON ${schema.courseExplore.courseCode} = ${schema.courses.code}
      WHERE ${whereSql}
      ORDER BY
        CASE
          WHEN ${schema.courses.code} ILIKE ${codePrefix} THEN 0
          WHEN ${schema.courses.code} ILIKE ${codeContains} THEN 1
          WHEN (
            ${normalizedQuery} <> ''
            AND ${schema.courseExplore.searchVector} @@ plainto_tsquery('simple', ${normalizedQuery})
          ) THEN 2
          ELSE 3
        END,
        CASE
          WHEN (
            ${normalizedQuery} <> ''
            AND ${schema.courseExplore.searchVector} @@ plainto_tsquery('simple', ${normalizedQuery})
          )
            THEN ts_rank(${schema.courseExplore.searchVector}, plainto_tsquery('simple', ${normalizedQuery}))
          ELSE 0
        END DESC,
        ${schema.courses.code} ASC
      LIMIT ${size}
    `);

  return (result.rows as Array<{ code: string }>).map((r) => ({
    courseCode: r.code,
    score: null,
  }));
}

export async function searchByEmbedding(
  embedding: number[],
  limit: number,
  departmentFilter: string | null,
): Promise<SearchHit[]> {
  const vectorLiteral = JSON.stringify(embedding);
  const conditions = [sql`${schema.courseExplore.embedding} IS NOT NULL`];
  if (departmentFilter) {
    conditions.push(
      sql`${schema.courses.department} ILIKE ${`%${departmentFilter}%`}`,
    );
  }
  const whereSql = sql.join(conditions, sql` AND `);

  const result = await db.execute(sql`
        WITH q AS (SELECT ${vectorLiteral}::vector AS v)
        SELECT
          ${schema.courses.code} AS code,
          1 - (${schema.courseExplore.embedding} <=> q.v) AS score
        FROM ${schema.courses}
        INNER JOIN ${schema.courseExplore}
          ON ${schema.courseExplore.courseCode} = ${schema.courses.code}
        CROSS JOIN q
        WHERE ${whereSql}
        ORDER BY ${schema.courseExplore.embedding} <=> q.v
        LIMIT ${limit}
      `);

  return (result.rows as Array<{ code: string; score: number }>).map((r) => ({
    courseCode: r.code,
    score: r.score,
  }));
}

export async function listDepartments(): Promise<string[]> {
  const result = await db.execute(
    sql`SELECT DISTINCT department FROM ${schema.courses} ORDER BY department ASC`,
  );
  return result.rows.map((r) => r.department as string);
}
