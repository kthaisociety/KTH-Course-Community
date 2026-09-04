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
    await searchByKeyword("machine learning", 10, null, false);

    const query = vi.mocked(db.execute).mock.calls[0]?.[0] as SQL | undefined;
    expect(query).toBeDefined();

    const queryText = new PgDialect()
      .sqlToQuery(query as SQL)
      .sql.toLowerCase();
    expect(queryText).toContain('left join "course_explore"');
  });
});
