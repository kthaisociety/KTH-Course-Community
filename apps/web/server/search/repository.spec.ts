import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { searchByKeyword } from "./repository";

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
