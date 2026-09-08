import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { applyTranscriptConfirmation } from "./repository";

vi.mock("../db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

describe("applyTranscriptConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("commits mixed creates and fills in one transaction", async () => {
    const insertQuery = {
      values() {
        return this;
      },
      onConflictDoNothing() {
        return this;
      },
      returning() {
        return Promise.resolve([{ courseCode: "SF1625" }]);
      },
    };
    const updateQuery = {
      set() {
        return this;
      },
      where() {
        return this;
      },
      returning() {
        return Promise.resolve([{ courseCode: "DD1337" }]);
      },
    };
    const tx = {
      insert: vi.fn(() => insertQuery),
      update: vi.fn(() => updateQuery),
    };
    vi.mocked(db.transaction).mockImplementation((callback) =>
      callback(tx as never),
    );

    await expect(
      applyTranscriptConfirmation(
        "user-1",
        [
          {
            courseCode: "SF1625",
            grade: "A",
            earnedCredits: 7.5,
            attendancePeriods: null,
            attendanceYear: 2023,
          },
        ],
        [
          {
            courseCode: "DD1337",
            grade: "B",
            earnedCredits: 6,
            attendancePeriods: null,
            attendanceYear: 2022,
          },
        ],
        new Date("2026-09-04T10:00:00.000Z"),
      ),
    ).resolves.toEqual({ inserted: 1, updated: 1 });

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      state: "every target field is populated",
      stored: { grade: "B", earnedCredits: 6, attendanceYear: 2022 },
      expectedUpdated: 0,
    },
    {
      state: "only grade is empty",
      stored: { grade: null, earnedCredits: 6, attendanceYear: 2022 },
      expectedUpdated: 1,
    },
    {
      state: "only earned credits is empty",
      stored: { grade: "B", earnedCredits: null, attendanceYear: 2022 },
      expectedUpdated: 1,
    },
    {
      state: "only attendance year is empty",
      stored: { grade: "B", earnedCredits: 6, attendanceYear: null },
      expectedUpdated: 1,
    },
  ])(
    "counts a fill truthfully when $state",
    async ({ stored, expectedUpdated }) => {
      const originalUpdatedAt = new Date("2026-08-20T08:00:00.000Z");
      let storedUpdatedAt = originalUpdatedAt;
      let nextUpdatedAt = originalUpdatedAt;
      let matchesStoredRow = true;

      const updateQuery = {
        set(values: { updatedAt: Date }) {
          nextUpdatedAt = values.updatedAt;
          return this;
        },
        where(condition: SQL) {
          const queryText = new PgDialect()
            .sqlToQuery(condition)
            .sql.toLowerCase();
          matchesStoredRow = [
            queryText.includes('"grade" is null') && stored.grade === null,
            queryText.includes('"earned_credits" is null') &&
              stored.earnedCredits === null,
            queryText.includes('"attendance_year" is null') &&
              stored.attendanceYear === null,
          ].some(Boolean);
          return this;
        },
        returning() {
          if (!matchesStoredRow) return Promise.resolve([]);
          storedUpdatedAt = nextUpdatedAt;
          return Promise.resolve([{ courseCode: "DD1337" }]);
        },
      };
      const tx = {
        insert: vi.fn(),
        update: vi.fn(() => updateQuery),
      };
      vi.mocked(db.transaction).mockImplementation((callback) =>
        callback(tx as never),
      );

      await expect(
        applyTranscriptConfirmation(
          "user-1",
          [],
          [
            {
              courseCode: "DD1337",
              grade: "A",
              earnedCredits: 7.5,
              attendancePeriods: null,
              attendanceYear: 2023,
            },
          ],
          new Date("2026-09-08T10:00:00.000Z"),
        ),
      ).resolves.toEqual({ inserted: 0, updated: expectedUpdated });

      if (expectedUpdated === 0) {
        expect(storedUpdatedAt).toEqual(originalUpdatedAt);
      } else {
        expect(storedUpdatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime(),
        );
      }
    },
  );

  it("rolls back inserts and earlier fills when a later fill fails", async () => {
    let persisted = ["existing:empty"];
    let stagedEarlierFill = false;

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      const pending = [...persisted];
      let updateNumber = 0;
      const insertQuery = {
        values() {
          return this;
        },
        onConflictDoNothing() {
          pending.push("created");
          return this;
        },
        returning() {
          return Promise.resolve([{ courseCode: "SF1625" }]);
        },
      };
      const updateQuery = {
        set() {
          return this;
        },
        where() {
          return this;
        },
        returning() {
          updateNumber += 1;
          if (updateNumber === 1) {
            pending[0] = "existing:filled";
            stagedEarlierFill = true;
            return Promise.resolve([{ courseCode: "DD1337" }]);
          }
          return Promise.reject(new Error("second fill failed"));
        },
      };
      const tx = {
        insert: vi.fn(() => insertQuery),
        update: vi.fn(() => updateQuery),
      };

      const result = await callback(tx as never);
      persisted = pending;
      return result;
    });

    await expect(
      applyTranscriptConfirmation(
        "user-1",
        [
          {
            courseCode: "SF1625",
            grade: "A",
            earnedCredits: 7.5,
            attendancePeriods: null,
            attendanceYear: 2023,
          },
        ],
        [
          {
            courseCode: "DD1337",
            grade: "B",
            earnedCredits: 6,
            attendancePeriods: null,
            attendanceYear: 2022,
          },
          {
            courseCode: "DD1396",
            grade: "C",
            earnedCredits: 7.5,
            attendancePeriods: null,
            attendanceYear: 2024,
          },
        ],
        new Date("2026-09-04T10:00:00.000Z"),
      ),
    ).rejects.toThrow("second fill failed");

    expect(persisted).toEqual(["existing:empty"]);
    expect(stagedEarlierFill).toBe(true);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});
