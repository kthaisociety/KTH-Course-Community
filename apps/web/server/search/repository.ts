import { sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";

export type SearchHit = {
  courseCode: string;
  score: number | null;
};

export async function searchByKeyword(
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

export async function searchByEmbedding(
  embedding: number[],
  limit: number,
  departmentFilter: string | null,
): Promise<SearchHit[]> {
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
}

export async function listDepartments(): Promise<string[]> {
  const result = await db.execute(
    sql`SELECT DISTINCT department FROM ${schema.courses} ORDER BY department ASC`,
  );
  return result.rows.map((r) => r.department as string);
}
