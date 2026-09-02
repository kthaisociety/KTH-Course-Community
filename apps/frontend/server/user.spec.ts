import { describe, expect, it } from "vitest";
import type { Database } from "./db";
import { createMockDb } from "./testing/mock-db";
import { toggleUserFavorite } from "./user";

describe("toggleUserFavorite", () => {
  it("removes an existing favorite", async () => {
    const db = createMockDb();
    db.queueResult([{ userId: "u1", favoriteCourse: "DD2421" }]);
    db.queueResult([]);

    const result = await toggleUserFavorite(
      db as unknown as Database,
      "u1",
      "DD2421",
    );

    expect(result).toEqual({ action: "removed" });
    expect(db.delete).toHaveBeenCalled();
  });

  it("adds a missing favorite", async () => {
    const db = createMockDb();
    db.queueResult([]);
    db.queueResult([]);

    const result = await toggleUserFavorite(
      db as unknown as Database,
      "u1",
      "DD2421",
    );

    expect(result).toEqual({ action: "added" });
    expect(db.insert).toHaveBeenCalled();
  });
});
