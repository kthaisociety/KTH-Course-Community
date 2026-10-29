import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLadokTranscript, TranscriptParseError } from "./parse";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function parseError(text: string): TranscriptParseError {
  try {
    parseLadokTranscript(text);
  } catch (error) {
    if (error instanceof TranscriptParseError) return error;
    throw error;
  }
  throw new Error("expected a TranscriptParseError");
}

const row = (
  courseName: string,
  credits: number,
  grade: string,
  completedOn: string,
) => ({ courseCode: null, courseName, credits, grade, completedOn });

describe("parseLadokTranscript", () => {
  // The fixtures follow the layout of real `unpdf` output from a Ladok
  // transcript — no course-code column, names wrapped above their columns —
  // with every personal detail replaced.
  it("reads every completed course off an English transcript, which prints no course codes", () => {
    expect(parseLadokTranscript(fixture("ladok-english.txt"))).toEqual([
      row("Calculus in One Variable", 7.5, "A", "2023-01-13"),
      row("Programming", 6, "P", "2023-06-02"),
      row("Linear Algebra", 7.5, "C", "2024-01-12"),
      row(
        "Interactive Programming and Computer Games in Distributed Environments",
        9,
        "B",
        "2024-06-03",
      ),
      row("Industrial Management, Basic Course", 6, "P", "2025-10-10"),
    ]);
  });

  it("reads a Swedish transcript, whose credits use a decimal comma", () => {
    expect(parseLadokTranscript(fixture("ladok-swedish.txt"))).toEqual([
      row("Envariabelanalys", 7.5, "A", "2023-01-13"),
      row("Programmering", 6, "P", "2023-06-02"),
      row("Linjär algebra", 7.5, "C", "2024-01-12"),
      row(
        "Interaktiv programmering och datorspel i distribuerade miljöer",
        9,
        "B",
        "2024-06-03",
      ),
      row("Industriell ekonomi, grundkurs", 6, "P", "2025-10-10"),
    ]);
  });

  it("skips preparatory-year rows, which Ladok counts in fup rather than hp", () => {
    const names = parseLadokTranscript(fixture("ladok-english.txt")).map(
      (candidate) => candidate.courseName,
    );

    expect(names.join(" ")).not.toContain("Preparatory");
    expect(names.join(" ")).not.toContain("meetings on campus");
  });

  it("stops at the summation block instead of reading the grading-scale notes", () => {
    const names = parseLadokTranscript(fixture("ladok-english.txt")).map(
      (candidate) => candidate.courseName,
    );

    expect(names).toHaveLength(5);
    expect(names.join(" ")).not.toContain("ECTS");
  });

  it("rejoins a row whose name and columns fall on either side of a page break", () => {
    expect(parseLadokTranscript(fixture("ladok-two-pages.txt"))).toEqual([
      row("Calculus in One Variable", 7.5, "A", "2023-01-13"),
      row("Programming", 6, "P", "2023-06-02"),
      row(
        "Theory and Methodology of Science with Applications in Computer Science",
        6,
        "B",
        "2024-03-15",
      ),
      row("Linear Algebra", 7.5, "C", "2024-01-12"),
      row("Industrial Management, Basic Course", 6, "P", "2025-10-10"),
    ]);
  });

  it("never joins the page footer or header, which name the student, into a course name", () => {
    const names = parseLadokTranscript(fixture("ladok-two-pages.txt"))
      .map((candidate) => candidate.courseName)
      .join(" ");

    expect(names).not.toContain("19900101-0000");
    expect(names).not.toContain("Anna Exempelsson");
    expect(names).not.toContain("ladok.se");
    expect(names).not.toContain("Page 1 / 2");
    expect(names).not.toContain("Scope Grade Date");
    expect(names).not.toContain("Transcript of Records");
  });

  it("treats any line carrying a personal identity number as furniture", () => {
    const transcript = [
      "Name Scope Grade Date Note",
      "Programming and",
      "Anna Exempelsson 900101-0000",
      "Computer Science 6.0 hp P 2023-06-02 2",
      "Summation",
    ].join("\n");

    expect(parseLadokTranscript(transcript)).toEqual([
      row("Programming and Computer Science", 6, "P", "2023-06-02"),
    ]);
  });

  it("rejects a certificate of registration and says which document to download", () => {
    const error = parseError(fixture("registreringsintyg.txt"));

    expect(error.message).toContain("certificate of registration");
    expect(error.message).toContain("Resultatintyg");
    expect(error.message).toContain("Transcript of Records");
  });

  it("rejects an English certificate of registration the same way", () => {
    const error = parseError(fixture("not-a-transcript.txt"));

    expect(error.message).toContain("Resultatintyg");
    expect(error.message).toContain("certificate of registration");
  });

  it("rejects a registration table even without its title", () => {
    const untitled = [
      "Code Name Scope Period Note",
      "DD2489 Scalable Software Development 7.5 hp 2026-10-26 - 2027-01-11 a",
    ].join("\n");

    expect(parseError(untitled).message).toContain(
      "certificate of registration",
    );
  });

  it("rejects a document that is not a transcript", () => {
    const letter = "Dear student,\nWelcome to KTH.\nKind regards";

    expect(parseError(letter).message).toContain("does not look like");
  });

  it("rejects an empty document", () => {
    expect(() => parseLadokTranscript("")).toThrow(TranscriptParseError);
  });

  it("rejects a transcript whose only rows are preparatory-year courses", () => {
    const preparatoryOnly = [
      "Name Scope Grade Date Note",
      "Physics for Technical Preparatory Year 9.0 fup P 2022-01-14 1",
      "Summation",
    ].join("\n");

    expect(parseError(preparatoryOnly).message).toContain(
      "No completed courses",
    );
  });

  it("rejects a transcript whose completed-courses table is empty", () => {
    const noResultsYet = [
      "Official Transcript of Records Print date",
      "2026-08-29",
      "Completed courses",
      "Name Scope Grade Date Note",
      "Summation",
      "Total included credited parts Credited education",
      "0.0 hp",
    ].join("\n");

    expect(() => parseLadokTranscript(noResultsYet)).toThrow(
      TranscriptParseError,
    );
  });

  it("does not let lines that never reach their columns grow into one name", () => {
    const runaway = [
      "Name Scope Grade Date Note",
      ...Array.from({ length: 500 }, (_, index) => `filler line ${index}`),
      "Programming 6.0 hp P 2023-06-02 2",
      "Summation",
    ].join("\n");

    const [only, ...others] = parseLadokTranscript(runaway);

    expect(others).toEqual([]);
    expect(only.courseName.length).toBeLessThan(120);
    expect(only).toMatchObject({ credits: 6, grade: "P" });
  });

  it("rejects a document too large to be a transcript, without scanning it", () => {
    const huge = `Name Scope Grade Date Note\n${"x".repeat(3_000_000)}`;

    const startedAt = performance.now();
    expect(() => parseLadokTranscript(huge)).toThrow(TranscriptParseError);
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });

  it("does not backtrack over a long line that almost ends like a row", () => {
    const almost = `${"7.5 hp A ".repeat(50_000)}2023-01-13 x`;
    const transcript = `Name Scope Grade Date Note\n${almost}\nSummation`;

    const startedAt = performance.now();
    expect(() => parseLadokTranscript(transcript)).toThrow(
      TranscriptParseError,
    );
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });

  it("keeps the transcript out of the error it reports", () => {
    for (const name of ["not-a-transcript.txt", "registreringsintyg.txt"]) {
      const message = parseError(fixture(name)).message;
      expect(message).not.toContain("Anna Exempelsson");
      expect(message).not.toContain("19900101-0000");
    }
  });

  describe("an export that prints a course-code column", () => {
    it("keeps the code it printed", () => {
      const transcript = [
        "Code Name Scope Grade Date Note",
        "SF1625 Calculus in One Variable 7.5 hp A 2023-01-13 1",
        "DD1389 Interactive Programming and Computer Games in",
        "Distributed Environments",
        "9.0 hp B 2024-06-03 1",
        "Summation",
      ].join("\n");

      expect(parseLadokTranscript(transcript)).toEqual([
        {
          courseCode: "SF1625",
          courseName: "Calculus in One Variable",
          credits: 7.5,
          grade: "A",
          completedOn: "2023-01-13",
        },
        {
          courseCode: "DD1389",
          courseName:
            "Interactive Programming and Computer Games in Distributed Environments",
          credits: 9,
          grade: "B",
          completedOn: "2024-06-03",
        },
      ]);
    });

    it("reads the Swedish header with its Kod column", () => {
      const transcript = [
        "Kod Benämning Omfattning Betyg Datum Not",
        "SF1625 Envariabelanalys 7,5 hp A 2023-01-13 1",
        "Summering",
      ].join("\n");

      expect(parseLadokTranscript(transcript)).toEqual([
        {
          courseCode: "SF1625",
          courseName: "Envariabelanalys",
          credits: 7.5,
          grade: "A",
          completedOn: "2023-01-13",
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
      const names = candidates.map((candidate) => candidate.courseName);

      expect(names.join(" ")).not.toContain("19900101-0000");
      expect(names.join(" ")).not.toContain("ladok.se");
      expect(candidates).toEqual([
        expect.objectContaining({ courseCode: "SF1625" }),
        {
          courseCode: "DD1337",
          courseName: "Programming",
          credits: null,
          grade: null,
          completedOn: null,
        },
        expect.objectContaining({ courseCode: "SF1672", credits: 7.5 }),
      ]);
    });

    it("reports a coded row whose scope, grade and date it cannot read", () => {
      const oddRow = [
        "Code Name Scope Grade Date Note",
        "SF1625 Calculus in One Variable 7.5 hp A 2023-01-13 1",
        "AK2030 Theory and Method of Science, with applications",
        "Summation",
      ].join("\n");

      expect(parseLadokTranscript(oddRow)[1]).toEqual({
        courseCode: "AK2030",
        courseName: "Theory and Method of Science, with applications",
        credits: null,
        grade: null,
        completedOn: null,
      });
    });

    it("reads ordinary and degree-project course codes", () => {
      const transcript = [
        "Code Name Scope Grade Date Note",
        "DD1337 Programming 6.0 hp P 2023-06-02 1",
        "DA232X Degree Project in Computer Science 30.0 hp P 2026-06-05 1",
        "SF279X Degree Project in Applied and",
        "Computational Mathematics",
        "Summation",
      ].join("\n");

      expect(parseLadokTranscript(transcript)).toEqual([
        expect.objectContaining({ courseCode: "DD1337" }),
        expect.objectContaining({ courseCode: "DA232X", credits: 30 }),
        {
          courseCode: "SF279X",
          courseName: "Degree Project in Applied and Computational Mathematics",
          credits: null,
          grade: null,
          completedOn: null,
        },
      ]);
    });

    it("does not take a three-digit code with a non-X suffix for a course code", () => {
      const transcript = [
        "Code Name Scope Grade Date Note",
        "SF279A Not a KTH Course Code 30.0 hp P 2026-06-05 1",
        "Summation",
      ].join("\n");

      expect(parseLadokTranscript(transcript)).toEqual([
        row("SF279A Not a KTH Course Code", 30, "P", "2026-06-05"),
      ]);
    });

    it("does not let one unterminated coded row absorb the rest of the document", () => {
      const runaway = [
        "Code Name Scope Grade Date Note",
        "SF1625 Calculus in One Variable",
        ...Array.from({ length: 500 }, (_, index) => `filler line ${index}`),
        "DD1337 Programming 6.0 hp P 2023-06-02 2",
        "Summation",
      ].join("\n");

      const candidates = parseLadokTranscript(runaway);

      expect(candidates).toHaveLength(2);
      expect(candidates[0].courseCode).toBe("SF1625");
      expect(candidates[0].courseName).not.toContain("filler line 499");
      expect(candidates[1]).toEqual({
        courseCode: "DD1337",
        courseName: "Programming",
        credits: 6,
        grade: "P",
        completedOn: "2023-06-02",
      });
    });
  });
});
