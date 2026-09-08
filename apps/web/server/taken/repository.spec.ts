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
