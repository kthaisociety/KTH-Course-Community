import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CoursePage,
  EmptyCoursePageError,
  fetchText,
  formatPeriods,
  getCourseInformation,
  getCourses,
  gradeScaleCode,
  htmlToText,
  parseCoursePage,
  parseCredits,
  parseExaminations,
  patternSeeds,
  toCourseDetail,
} from "./kth-web";

// Trimmed from the real SF1624 page (2026-11).
const sv: CoursePage = {
  courseInfo: {
    course_code: "SF1624",
    course_title: "Algebra och geometri",
    course_credits_label: "7,5 hp",
    course_department: "SCI/Matematik",
    course_department_code: "SF",
    course_level_code: "1",
    course_grade_scale: "A, B, C, D, E, FX, F",
    course_main_subject: "Matematik, Teknik",
    course_is_discontinued: false,
  },
  syllabusList: [
    {
      course_goals: "<p>old goals</p>",
      course_content: "<p>old content</p>",
      course_eligibility: "<i>Ingen information tillagd</i>",
      course_examination:
        "<ul><li>TEN1 - Tentamen, 9,0 hp, betygsskala: A, B, C, D, E, FX, F</li></ul>",
      course_valid_from: { year: 2010, semesterNumber: 2 },
    },
    {
      course_goals: "<p>Efter genomgången kurs ska studenten kunna</p>",
      course_content: "<p>Vektorer, matriser</p>",
      course_eligibility: "<p>Grundläggande behörighet.</p>\n",
      course_examination:
        "<ul><li>TEN1 - Tentamen, 7,5 hp, betygsskala: A, B, C, D, E, FX, F</li><li>LAB1 - Laborationer, 1,5 hp, betygsskala: P, F</li></ul>",
      course_valid_from: { year: 2019, semesterNumber: 2 },
    },
  ],
  roundsBySemester: {
    "20262": [
      {
        round_course_term: [2026, 2],
        round_study_pace: 50,
        round_schedule: "https://cloud.timeedit.net/kth/x",
        round_tutoring_language: "Svenska",
        round_tutoring_form: "NML",
        round_tutoring_time: "DAG",
        round_periods: '<p class="periode-list">HT 2026: P2 (7.5 hp)</p>',
        round_part_of_programme: "<p><a>CDATE åk 1</a></p>",
        show_application_link: false,
        round_is_cancelled: false,
      },
    ],
    "20271": [{ round_course_term: [2027, 1], round_is_cancelled: true }],
  },
};

const en: CoursePage = {
  ...sv,
  courseInfo: { ...sv.courseInfo, course_title: "Algebra and Geometry" },
};

const pageHtml = (courseData: unknown) =>
  `<script>window.__compressedData__DATA = "${encodeURIComponent(JSON.stringify({ courseData }))}"</script>`;

describe("toCourseDetail", () => {
  const warn = vi.fn();
  const detail = toCourseDetail(sv, en, warn);

  it("maps course fields to KOPPS shapes", () => {
    expect(detail.course).toEqual({
      courseCode: "SF1624",
      departmentCode: "SF",
      department: { name: "SCI/Matematik" },
      educationalLevelCode: "BASIC",
      gradeScaleCode: "AF",
      title: "Algebra och geometri",
      titleOther: "Algebra and Geometry",
      credits: 7.5,
      creditUnitAbbr: "hp",
      state: "ESTABLISHED",
    });
    expect(detail.mainSubjects).toEqual(["Matematik", "Teknik"]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("marks a discontinued course DEACTIVATED", () => {
    const page = {
      ...sv,
      courseInfo: { ...sv.courseInfo, course_is_discontinued: true },
    };
    expect(toCourseDetail(page, en, warn).course.state).toBe("DEACTIVATED");
  });

  it("orders syllabi newest first and blanks placeholders", () => {
    expect(
      detail.publicSyllabusVersions.map((s) => s.validFromTerm.term),
    ).toEqual([20192, 20102]);
    expect(detail.publicSyllabusVersions[0].courseSyllabus.goals).toContain(
      "Efter genomgången",
    );
    expect(detail.publicSyllabusVersions[1].courseSyllabus.eligibility).toBe(
      "",
    );
  });

  it("takes examinations from the newest syllabus", () => {
    expect(detail.examinationSets).toEqual({
      "20192": {
        examinationRounds: [
          {
            examCode: "TEN1",
            title: "Tentamen",
            credits: 7.5,
            gradeScaleCode: "AF",
          },
          {
            examCode: "LAB1",
            title: "Laborationer",
            credits: 1.5,
            gradeScaleCode: "PF",
          },
        ],
      },
    });
  });

  it("maps rounds, drops cancelled ones, but reports their terms as covered", () => {
    expect(detail.roundInfos).toEqual([
      {
        schemaUrl: "https://cloud.timeedit.net/kth/x",
        round: {
          startTerm: { term: 20262 },
          isPU: true,
          isVU: false,
          studyPace: 50,
          tutoringForm: { name: "Normal" },
          tutoringTimeOfDay: { name: "Dagtid" },
          language: "Svenska",
          courseRoundTerms: [{ formattedPeriodsAndCredits: "P2 (7,5 hp)" }],
        },
      },
    ]);
    expect(detail.coveredRoundTerms).toEqual([20262, 20271]);
  });

  it("falls back to the Swedish title without an English page", () => {
    expect(toCourseDetail(sv, undefined, warn).course.titleOther).toBe(
      "Algebra och geometri",
    );
  });

  it("handles a course with no syllabus or rounds", () => {
    const d = toCourseDetail(
      { ...sv, syllabusList: [], roundsBySemester: {} },
      en,
      warn,
    );
    expect(d.publicSyllabusVersions).toEqual([]);
    expect(d.examinationSets).toEqual({});
    expect(d.roundInfos).toEqual([]);
    expect(d.coveredRoundTerms).toEqual([]);
  });

  it("warns instead of silently defaulting", () => {
    const w = vi.fn();
    const d = toCourseDetail(
      {
        ...sv,
        courseInfo: {
          ...sv.courseInfo,
          course_credits_label: "",
          course_level_code: "",
        },
        syllabusList: [
          {
            course_examination: "<ul><li>undefined - undefined</li></ul>",
            course_valid_from: { year: 2020, semesterNumber: 1 },
          },
        ],
      },
      en,
      w,
    );
    expect(d.course.credits).toBe(0);
    expect(d.course.educationalLevelCode).toBe("");
    expect(w.mock.calls.map(([m]) => m)).toEqual([
      'SF1624: credits "" did not parse',
      'SF1624: unknown level code ""',
      'SF1624: examination "undefined - undefined" did not parse',
    ]);
  });
});

describe("patternSeeds", () => {
  it("adds digits to every prefix and letters only where codes take them", () => {
    const seeds = patternSeeds(["SF1624", "SF2000", "FCA3006", "UMK100"]);
    expect(seeds.filter((s) => s.startsWith("SF"))).toHaveLength(10);
    expect(seeds.filter((s) => s.startsWith("FC"))).toHaveLength(36);
    expect(seeds.filter((s) => s.startsWith("UM"))).toHaveLength(36);
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

describe("helpers", () => {
  it("parses credits", () => {
    expect(parseCredits("7,5 hp")).toEqual({ credits: 7.5, unit: "hp" });
    expect(parseCredits("2.0 fup")).toEqual({ credits: 2, unit: "fup" });
    expect(parseCredits(undefined)).toBeUndefined();
    expect(parseCredits("hp")).toBeUndefined();
  });

  it("maps grade scales", () => {
    expect(gradeScaleCode("P, F")).toBe("PF");
    expect(gradeScaleCode("VG, G, U")).toBe("VG,G,U");
  });

  it("parses English examination lists", () => {
    expect(
      parseExaminations(
        "<ul><li>MOM1 - Moment 1, 2.0 fup, grading scale: P, F</li></ul>",
      ),
    ).toEqual([
      { examCode: "MOM1", title: "Moment 1", credits: 2, gradeScaleCode: "PF" },
    ]);
  });

  it("keeps commas inside an examination title", () => {
    expect(
      parseExaminations(
        "<li>KON1 - Kontroll, del 1, 1,5 hp, betygsskala: P, F</li>",
      )[0],
    ).toMatchObject({ title: "Kontroll, del 1", credits: 1.5 });
  });

  it("reads HTML as one line of text, entities decoded", () => {
    expect(htmlToText("<p>Obligatorisk f&#246;r &#229;k1</p>")).toBe(
      "Obligatorisk för åk1",
    );
  });

  it("formats multi-period rounds", () => {
    expect(formatPeriods("<p>HT 2026: P1 (3.0 hp), P2 (4.5 hp)</p>")).toBe(
      "P1 (3,0 hp), P2 (4,5 hp)",
    );
  });

  it("reads a placeholder study pace as no pace", () => {
    const page = parseCoursePage(
      pageHtml({
        ...sv,
        roundsBySemester: {
          "20262": [
            {
              round_course_term: [2026, 2],
              round_study_pace: "<i>Ingen information tillagd</i>",
            },
          ],
        },
      }),
    );
    expect(page.roundsBySemester["20262"][0].round_study_pace).toBeUndefined();
    expect(
      toCourseDetail(page, en, vi.fn()).roundInfos[0].round.studyPace,
    ).toBeUndefined();
  });

  it("decodes and validates the embedded page JSON", () => {
    expect(parseCoursePage(pageHtml(sv)).courseInfo.course_code).toBe("SF1624");
    expect(() => parseCoursePage("<html></html>")).toThrow(/not found/);
    expect(() => parseCoursePage(pageHtml({}))).toThrow(EmptyCoursePageError);
    // A field of the wrong type fails loudly rather than being written.
    expect(() =>
      parseCoursePage(
        pageHtml({ ...sv, courseInfo: { ...sv.courseInfo, course_code: 42 } }),
      ),
    ).toThrow();
  });
});

describe("HTTP", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const ok = (body: string) => new Response(body, { status: 200 });

  it("retries a failing request, then succeeds", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(ok("hello"));
    const result = fetchText("https://x/a");
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("hello");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("does not retry a 404", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    const result = fetchText("https://x/missing");
    const assertion = expect(result).rejects.toThrow("HTTP 404");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after three attempts", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    const result = fetchText("https://x/down");
    const assertion = expect(result).rejects.toThrow("HTTP 500");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("lists by department, then by code pattern, splitting patterns that overflow", async () => {
    const store = encodeURIComponent(
      JSON.stringify({
        currentSchoolsWithDepartments: [
          { code: "AF", departments: [{ code: "AFA" }, { code: "SF" }] },
        ],
        deprecatedSchoolsWithDepartments: [],
      }),
    );
    const course = (kod: string) => ({ kod, benamning: kod });
    const byDepartment: Record<string, unknown> = {
      AF: { searchData: { results: [] }, errorCode: "overflow" },
      AFA: { searchData: { results: [course("AF1000")] } },
      SF: { searchData: { results: [course("SF1624"), course("AF1000")] } },
    };
    const byPattern: Record<string, unknown> = {
      // Owned by a school-level code, so only the pattern pass finds it.
      AF2: { searchData: { results: [course("AF2001")] } },
      SF1: { searchData: { results: [] }, errorCode: "overflow" },
      // "unknown" hides hits just as "overflow" does.
      VS2: { searchData: { results: [] }, errorCode: "unknown" },
      // A name match on another code is not a prefix hit and is dropped.
      SF16: {
        searchData: { results: [course("SF1624"), course("XX1234")] },
      },
      SF17: { searchData: { results: [course("SF1700")] } },
      VS20: { searchData: { results: [course("VS2010")] } },
      // A longer "unknown" is taken as empty, not split again.
      VS21: { searchData: { results: [] }, errorCode: "unknown" },
    };
    const patterns: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/org")) {
        return ok(
          `<script>window.__compressedApplicationStore__ = "${store}"</script>`,
        );
      }
      const params = new URL(url).searchParams;
      const department = params.get("department");
      if (department) return ok(JSON.stringify(byDepartment[department]));
      const pattern = params.get("pattern") ?? "";
      patterns.push(pattern);
      return ok(
        JSON.stringify(byPattern[pattern] ?? { searchData: { results: [] } }),
      );
    });
    const warn = vi.fn();
    // VS2010 is only known from the catalogue; its prefix is searched too.
    const pending = getCourses(warn, ["VS2010"]);
    await vi.runAllTimersAsync();
    const courses = await pending;
    expect(courses.map((c) => c.code).sort()).toEqual([
      "AF1000",
      "AF2001",
      "SF1624",
      "SF1700",
      "VS2010",
    ]);
    // AF, SF and VS by digit; SF1 and VS2 split by every code character.
    expect(patterns).toHaveLength(10 * 3 + 36 * 2);
    expect(patterns).toContain("SF1Z");
    expect(patterns).toContain("VS2");
    expect(patterns).not.toContain("VS210");
    expect(warn).not.toHaveBeenCalled();
  });

  it("re-fetches a course page that came back without course data", async () => {
    const empty = pageHtml({ language: "sv" });
    let svCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("l=en")) return ok(pageHtml(en));
      svCalls++;
      return ok(svCalls === 1 ? empty : pageHtml(sv));
    });
    const result = getCourseInformation(
      { code: "SF1624", name: "x", department: "SF", state: "ESTABLISHED" },
      vi.fn(),
    );
    await vi.runAllTimersAsync();
    expect((await result).course.courseCode).toBe("SF1624");
    expect(svCalls).toBe(2);
  });

  it("does not re-fetch a page whose data fails the schema", async () => {
    const bad = pageHtml({
      ...sv,
      courseInfo: { ...sv.courseInfo, course_title: 42 },
    });
    fetchMock.mockImplementation(async () => ok(bad));
    const result = getCourseInformation(
      { code: "SF1624", name: "x", department: "SF", state: "ESTABLISHED" },
      vi.fn(),
    );
    const assertion = expect(result).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2); // sv and en, once each
  });

  it("fetches both languages and survives a missing English page", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("l=en")
        ? new Response("", { status: 404 })
        : ok(pageHtml(sv)),
    );
    const warn = vi.fn();
    const result = getCourseInformation(
      { code: "SF1624", name: "x", department: "SF", state: "ESTABLISHED" },
      warn,
    );
    await vi.runAllTimersAsync();
    const detail = await result;
    expect(detail.course.titleOther).toBe("Algebra och geometri");
    expect(warn.mock.calls[0][0]).toMatch(/^SF1624: English page failed/);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([
      "https://www.kth.se/student/kurser/kurs/SF1624?l=sv",
      "https://www.kth.se/student/kurser/kurs/SF1624?l=en",
    ]);
  });
});
