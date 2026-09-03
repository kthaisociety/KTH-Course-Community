import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLadokTranscript, TranscriptParseError } from "./parse";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

describe("parseLadokTranscript", () => {
  it("reads every completed course off an English transcript", () => {
    const candidates = parseLadokTranscript(fixture("ladok-english.txt"));

    expect(candidates).toEqual([
      {
        courseCode: "SF1625",
        courseName: "Calculus in One Variable",
        credits: 7.5,
        grade: "A",
        completedOn: "2023-01-13",
      },
      {
        courseCode: "DD1337",
        courseName: "Programming",
        credits: 6,
        grade: "P",
        completedOn: "2023-06-02",
      },
      {
        courseCode: "SF1672",
        courseName: "Linear Algebra",
        credits: 7.5,
        grade: "C",
        completedOn: "2024-01-12",
      },
      {
        courseCode: "DD1389",
        courseName:
          "Interactive Programming and Computer Games in Distributed Environments",
        credits: 9,
        grade: "B",
        completedOn: "2024-06-03",
      },
      {
        courseCode: "ME1003",
        courseName: "Industrial Management, Basic Course",
        credits: 6,
        grade: "P",
        completedOn: "2025-10-10",
      },
    ]);
  });

  it("reads a Swedish transcript, whose credits use a decimal comma", () => {
    const candidates = parseLadokTranscript(fixture("ladok-swedish.txt"));

    expect(candidates).toEqual([
      {
        courseCode: "SF1625",
        courseName: "Envariabelanalys",
        credits: 7.5,
        grade: "A",
        completedOn: "2023-01-13",
      },
      {
        courseCode: "DD1337",
        courseName: "Programmering",
        credits: 6,
        grade: "P",
        completedOn: "2023-06-02",
      },
      {
        courseCode: "SF1672",
        courseName: "Linjär algebra",
        credits: 7.5,
        grade: "C",
        completedOn: "2024-01-12",
      },
      {
        courseCode: "DD1389",
        courseName:
          "Interaktiv programmering och datorspel i distribuerade miljöer",
        credits: 9,
        grade: "B",
        completedOn: "2024-06-03",
      },
      {
        courseCode: "ME1003",
        courseName: "Industriell ekonomi, grundkurs",
        credits: 6,
        grade: "P",
        completedOn: "2025-10-10",
      },
    ]);
  });

  it("stops at the summation block instead of reading the grading-scale notes", () => {
    const codes = parseLadokTranscript(fixture("ladok-english.txt")).map(
      (candidate) => candidate.courseCode,
    );

    expect(codes).toHaveLength(5);
    expect(codes).not.toContain("ECTS");
  });

  it("rejects a document that is not a transcript", () => {
    expect(() => parseLadokTranscript(fixture("not-a-transcript.txt"))).toThrow(
      TranscriptParseError,
    );
  });

  it("rejects an empty document", () => {
    expect(() => parseLadokTranscript("")).toThrow(TranscriptParseError);
  });

  it("reads across a page break, past the footer and the repeated header", () => {
    const candidates = parseLadokTranscript(fixture("ladok-two-pages.txt"));

    expect(candidates).toEqual([
      {
        courseCode: "SF1625",
        courseName: "Calculus in One Variable",
        credits: 7.5,
        grade: "A",
        completedOn: "2023-01-13",
      },
      {
        courseCode: "DD1337",
        courseName: "Programming",
        credits: 6,
        grade: "P",
        completedOn: "2023-06-02",
      },
      {
        courseCode: "SF1672",
        courseName: "Linear Algebra",
        credits: 7.5,
        grade: "C",
        completedOn: "2024-01-12",
      },
      {
        courseCode: "ME1003",
        courseName: "Industrial Management, Basic Course",
        credits: 6,
        grade: "P",
        completedOn: "2025-10-10",
      },
    ]);
  });

  it("never joins page furniture onto an incomplete row at a page break", () => {
    const incompleteBeforeBreak = [
      "Code Name Scope Grade Date Note",
      "SF1625 Calculus in One Variable 7.5 hp A 2023-01-13 1",
      "DD1337 Programming",
      "Check the certificate on: https://student.ladok.se/verifiera/ Personal identity number: 19900101-0000",
      "Verifiable until: 2026-11-27 Control code: AAAA0AAAAA",
      "Postal address Contact information Page 1 / 2",
      "KTH Royal Institute of Technology",
      "100 44 Stockholm",
      "Code Name Scope Grade Date Note",
      "SF1672 Linear Algebra 7.5 hp C 2024-01-12 1",
      "Summation",
    ].join("\n");

    const candidates = parseLadokTranscript(incompleteBeforeBreak);
    const names = candidates.map((candidate) => candidate.courseName).join(" ");

    expect(names).not.toContain("19900101-0000");
    expect(names).not.toContain("ladok.se");
    expect(names).not.toContain("Page 1 / 2");
    expect(names).not.toContain("Scope Grade Date");
    expect(candidates).toEqual([
      {
        courseCode: "SF1625",
        courseName: "Calculus in One Variable",
        credits: 7.5,
        grade: "A",
        completedOn: "2023-01-13",
      },
      {
        courseCode: "DD1337",
        courseName: "Programming",
        credits: null,
        grade: null,
        completedOn: null,
      },
      {
        courseCode: "SF1672",
        courseName: "Linear Algebra",
        credits: 7.5,
        grade: "C",
        completedOn: "2024-01-12",
      },
    ]);
  });

  it("reports a row whose scope, grade and date it cannot read", () => {
    const oddRow = [
      "Code Name Scope Grade Date Note",
      "SF1625 Calculus in One Variable 7.5 hp A 2023-01-13 1",
      "AK2030 Theory and Method of Science, with applications",
      "Summation",
    ].join("\n");

    expect(parseLadokTranscript(oddRow)).toEqual([
      {
        courseCode: "SF1625",
        courseName: "Calculus in One Variable",
        credits: 7.5,
        grade: "A",
        completedOn: "2023-01-13",
      },
      {
        courseCode: "AK2030",
        courseName: "Theory and Method of Science, with applications",
        credits: null,
        grade: null,
        completedOn: null,
      },
    ]);
  });

  it("rejects a document too large to be a transcript, without scanning it", () => {
    const huge = `Code Name Scope Grade Date Note\nSF1625 ${"x".repeat(3_000_000)}`;

    const startedAt = performance.now();
    expect(() => parseLadokTranscript(huge)).toThrow(TranscriptParseError);
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });

  it("does not let one unterminated row absorb the rest of the document", () => {
    const runaway = [
      "Code Name Scope Grade Date Note",
      "SF1625 Calculus in One Variable",
      ...Array.from({ length: 500 }, (_, index) => `filler line ${index}`),
      "DD1337 Programming 6.0 hp P 2023-06-02 2",
      "Summation",
    ].join("\n");

    const candidates = parseLadokTranscript(runaway);

    expect(candidates).toHaveLength(2);
    expect(candidates[0].courseName).not.toContain("filler line 499");
    expect(candidates[1]).toEqual({
      courseCode: "DD1337",
      courseName: "Programming",
      credits: 6,
      grade: "P",
      completedOn: "2023-06-02",
    });
  });

  it("rejects a transcript whose completed-courses table is empty", () => {
    const noResultsYet = [
      "Official Transcript of Records Print date",
      "2026-08-29",
      "Completed courses",
      "Code Name Scope Grade Date Note",
      "Summation",
      "Total included credited parts Credited education",
      "0.0 hp",
    ].join("\n");

    expect(() => parseLadokTranscript(noResultsYet)).toThrow(
      TranscriptParseError,
    );
  });

  it("keeps the transcript out of the error it reports", () => {
    const transcript = fixture("not-a-transcript.txt");

    try {
      parseLadokTranscript(transcript);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain("Anna Exempelsson");
      expect((error as Error).message).not.toContain("19900101-0000");
    }
  });
});
