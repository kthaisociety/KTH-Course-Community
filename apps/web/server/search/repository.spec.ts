import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { searchByEmbedding, searchByKeyword } from "./repository";

vi.mock("../db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

describe("searchByKeyword", () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockReset();
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);
  });

  it("does not require a course_explore row for code and title matches", async () => {
    await searchByKeyword("machine learning", 10, null);

    const query = vi.mocked(db.execute).mock.calls[0]?.[0] as SQL | undefined;
    expect(query).toBeDefined();

    const queryText = new PgDialect()
      .sqlToQuery(query as SQL)
      .sql.toLowerCase();
    expect(queryText).toContain('left join "course_explore"');
  });

  /**
   * The LIMIT is the size it was handed, full stop.
   *
   * It used to be `size * 5` whenever the caller flagged a minimum-rating
   * filter, so the service had a window to throw rows out of after the fact.
   * That filter is gone; a five-fold over-fetch left behind would cost every
   * search and buy nothing.
   */
  it("limits to exactly the size it was given", async () => {
    await searchByKeyword("machine learning", 10, null);

    const query = vi.mocked(db.execute).mock.calls[0]?.[0] as SQL | undefined;
    const { sql: text, params } = new PgDialect().sqlToQuery(query as SQL);
    const limitIndex = Number(text.match(/limit \$(\d+)/i)?.[1]);
    expect(limitIndex).toBeGreaterThan(0);
    expect(params[limitIndex - 1]).toBe(10);
  });
});

describe("searchByEmbedding", () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockReset();
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);
  });

  /**
   * Distance alone is not a total order, and an ORDER BY that is not total
   * promises nothing: two rows at the identical distance may come back in
   * either order between two executions. Under a plain LIMIT that is
   * invisible. Under paging it is a bug — the service pages by slicing one
   * ordered prefix, so a pair that swaps between the fetch for page 2 and the
   * fetch for page 3 puts one course on both pages and the other on neither.
   *
   * Appending the primary key makes the order total, which is what turns a
   * LIMIT into a stable prefix. This asserts the tiebreak is there *and* that
   * it comes after the distance — the difference between a tiebreak and an
   * alphabetical search, and what keeps the HNSW index providing the ordering
   * with only the ties sorted above it.
   */
  it("breaks distance ties on the course code, so a prefix is stable", async () => {
    await searchByEmbedding([0.1, 0.2], 10, null);

    const query = vi.mocked(db.execute).mock.calls[0]?.[0] as SQL | undefined;
    const text = new PgDialect().sqlToQuery(query as SQL).sql.toLowerCase();

    const orderBy = text.slice(text.lastIndexOf("order by"));
    expect(orderBy).toContain("<=>");
    expect(orderBy).toContain('"courses"."code" asc');
    expect(orderBy.indexOf("<=>")).toBeLessThan(
      orderBy.indexOf('"courses"."code" asc'),
    );
  });
});
