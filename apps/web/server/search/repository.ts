import { sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";

export type SearchHit = {
  courseCode: string;
  score: number | null;
};

/**
 * `size` is the LIMIT, exactly — never inflated to leave room for a filter
 * applied after the query. Every filter here is a SQL predicate, so every row
 * the query returns already satisfies it.
 *
 * The service asks for a window covering every page up to the one it is
 * serving, plus one row of lookahead. That is a bigger number, not an inflated
 * one, and it works only because this query is *totally* ordered: the three-way
 * bucket, then `ts_rank`, then `courses.code ASC`. A LIMIT over a total order
 * returns a prefix, so a wider window returns a superset that begins with the
 * narrower one, and page 2 holds the same rows however deep the fetch went.
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

/**
 * Nearest neighbours by cosine distance — and, on ties, by course code.
 *
 * The tiebreak is not cosmetic. Distance alone is not a total order, and an
 * ORDER BY that is not total obliges the executor to nothing: two rows at the
 * identical distance may come back in either order between two executions of
 * the same query. Under a plain LIMIT that is invisible — the same set, only
 * shuffled. Under pagination it is a bug: the service pages by slicing one
 * ordered prefix, so a pair that swaps between the fetch for page 2 and
 * the fetch for page 3 puts one course on both pages and the other on neither.
 *
 * `courses.code` is the primary key, so appending it makes the order total, and
 * total is what makes a LIMIT a stable prefix. `searchByKeyword` above already
 * ends this way for the same reason. The distance stays the leading key, so the
 * HNSW index still provides the ordering and only the ties above it are sorted;
 * the second key does not turn this into an alphabetical search.
 *
 * What it does *not* buy is exactness, and the comment would be dishonest
 * without saying so. `course_explore_embedding_idx` is HNSW — approximate by
 * construction, with a search list pgvector widens as the LIMIT grows — so a
 * 61-row fetch is not *formally* guaranteed to begin with the same rows as a
 * 21-row one, however reliably it does at this catalogue size. The tiebreak
 * removes the one source of drift that is entirely ours. What bounds the rest
 * is that this leg only ever supplies the tail: the service puts the exact
 * keyword ranking first and appends these behind it.
 */
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
        ORDER BY
          ${schema.courseExplore.embedding} <=> q.v,
          ${schema.courses.code} ASC
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
