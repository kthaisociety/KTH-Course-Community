import { describe, expect, it } from "vitest";
import { DEFAULT_TEST_COURSES, parseIngestArgs } from "./args";

describe("parseIngestArgs", () => {
  it("runs a full ingest without --test", () => {
    expect(parseIngestArgs([])).toEqual({});
  });

  it("samples the default number of courses with a bare --test", () => {
    expect(parseIngestArgs(["--test"])).toEqual({
      testCourses: DEFAULT_TEST_COURSES,
    });
  });

  it("reads the sample size after --test", () => {
    expect(parseIngestArgs(["--test", "25"])).toEqual({ testCourses: 25 });
  });

  it("reads the sample size from --test=", () => {
    expect(parseIngestArgs(["--test=200"])).toEqual({ testCourses: 200 });
  });

  it("does not take a following flag as the sample size", () => {
    expect(parseIngestArgs(["--test", "--verbose"])).toEqual({
      testCourses: DEFAULT_TEST_COURSES,
    });
  });

  it.each(["0", "-5", "2.5", "many", ""])(
    "rejects %j as a sample size",
    (raw) => {
      expect(() => parseIngestArgs([`--test=${raw}`])).toThrow(
        /whole number of courses/,
      );
    },
  );
});
