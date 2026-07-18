import { parseTranscript } from "./transcript.parser";

describe("parseTranscript", () => {
  it("parses code, credits and grade from a single line", () => {
    const result = parseTranscript(
      "SF1624 Algebra och geometri 7,5 hp A 2023-01-13",
    );

    expect(result).toEqual([
      { courseCode: "SF1624", grade: "A", credits: 7.5 },
    ]);
  });

  it("prefers the grade after the credits over letters in the course title", () => {
    const result = parseTranscript("EN1010 English A 6,0 hp B 2023-06-05");

    expect(result).toEqual([{ courseCode: "EN1010", grade: "B", credits: 6 }]);
  });

  it("falls back to the whole block when no grade follows the credits", () => {
    const result = parseTranscript("SF1626 Flervariabelanalys C 7,5 hp");

    expect(result).toEqual([
      { courseCode: "SF1626", grade: "C", credits: 7.5 },
    ]);
  });

  it("reads details from up to three following lines", () => {
    const result = parseTranscript(
      "DA231X Degree Project in Computer Science\n30.0 hp\nA\n2024-06-05",
    );

    expect(result).toEqual([{ courseCode: "DA231X", grade: "A", credits: 30 }]);
  });

  it("stops the window at the next course code", () => {
    const result = parseTranscript(
      "SF1624 Algebra och geometri\nSF1625 Envariabelanalys 7,5 hp B",
    );

    expect(result).toEqual([
      { courseCode: "SF1624", grade: null, credits: null },
      { courseCode: "SF1625", grade: "B", credits: 7.5 },
    ]);
  });

  it("handles Fx grades", () => {
    const result = parseTranscript("SF1624 Algebra och geometri 7,5 hp Fx");

    expect(result).toEqual([
      { courseCode: "SF1624", grade: "Fx", credits: 7.5 },
    ]);
  });

  it("keeps only the first occurrence of a repeated course code", () => {
    const result = parseTranscript(
      "SF1624 Algebra och geometri 7,5 hp A\nSF1624 Algebra och geometri 7,5 hp B",
    );

    expect(result).toEqual([
      { courseCode: "SF1624", grade: "A", credits: 7.5 },
    ]);
  });

  it("returns an empty array when no course codes are present", () => {
    expect(parseTranscript("Transcript of records\nName: Sven")).toEqual([]);
  });
});
