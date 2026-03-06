/**
 * Mock data for course card diagrams (Option A – frontend-only).
 * Replace with API/Neon data later when available.
 */

export type ExaminationMethods = {
  homeAssignments: number;
  onCampusExam: number;
  laboratoryMoments: number;
};

export type TheoreticalVsApplied = {
  theoretical: number;
  applied: number;
};

export type CourseCardChartData = {
  examinationMethods: ExaminationMethods;
  theoreticalVsApplied: TheoreticalVsApplied;
  workload: number; // 1–10
  learningExperience: number; // 1–10
};

/** Simple deterministic hash from string to number in [0, 1). */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) / 0x80000000;
}

/** Returns mock chart data for a course code. Same code always gets same values. */
export function getMockChartData(courseCode: string): CourseCardChartData {
  const h = hash(courseCode);
  const h2 = hash(courseCode + "2");
  const h3 = hash(courseCode + "3");

  // Three segments summing to 100 (examination methods): yellow, blue, green
  const rawA = 0.2 + 0.6 * h;
  const rawB = 0.2 + 0.6 * h2;
  const rawC = 0.2 + 0.6 * (1 - h - h2);
  const total = rawA + rawB + rawC;
  const examinationMethods: ExaminationMethods = {
    homeAssignments: Math.round((100 * rawA) / total),
    onCampusExam: Math.round((100 * rawB) / total),
    laboratoryMoments: Math.round((100 * rawC) / total),
  };
  const sumEx =
    examinationMethods.homeAssignments +
    examinationMethods.onCampusExam +
    examinationMethods.laboratoryMoments;
  if (sumEx !== 100) {
    examinationMethods.laboratoryMoments += 100 - sumEx;
  }

  // Two segments summing to 100 (theoretical vs applied)
  const theoretical = Math.round(20 + 60 * h3);
  const applied = Math.max(0, 100 - theoretical);
  const theoreticalVsApplied: TheoreticalVsApplied = {
    theoretical: Math.min(100, theoretical),
    applied: Math.min(100, applied),
  };
  if (theoreticalVsApplied.theoretical + theoreticalVsApplied.applied !== 100) {
    theoreticalVsApplied.applied =
      100 - theoreticalVsApplied.theoretical;
  }

  // 1–10 scales
  const workload = Math.max(1, Math.min(10, Math.round(1 + 9 * h)));
  const learningExperience = Math.max(
    1,
    Math.min(10, Math.round(1 + 9 * (1 - h2))),
  );

  return {
    examinationMethods,
    theoreticalVsApplied,
    workload,
    learningExperience,
  };
}

export function getFallbackTitle(courseCode: string): string {
  return `Course ${courseCode}`;
}

export function getFallbackContent(): string {
  return "No course content description available.";
}

export type CourseCardStats = {
  reviewCount: number;
  recommendCount: number;
  studentsTaken: number;
};

/** Mock stats for card footer. Replace with API data when available. */
export function getMockCourseStats(courseCode: string): CourseCardStats {
  const h = hash(courseCode);
  const h2 = hash(courseCode + "stats2");
  const h3 = hash(courseCode + "stats3");
  return {
    reviewCount: Math.max(0, Math.round(3 + 47 * h)),
    recommendCount: Math.max(0, Math.round(1 + 24 * h2)),
    studentsTaken: Math.max(0, Math.round(10 + 240 * h3)),
  };
}

/** Mock keywords. Replace with API data when available. */
export function getMockKeywords(courseCode: string): string {
  const keywords = ["programming", "Java", "algorithms", "data structures", "intro"];
  const h = hash(courseCode);
  const idx = Math.floor(h * (keywords.length - 1));
  return keywords[idx] ?? "—";
}

/** Course codes with explicit mock prerequisites. Others get hash-based variety. */
const PREREQUISITES_BY_COURSE: Record<string, string[]> = {
  "DD1338": ["DD1337", "SF1626"],
  "DD2440": ["DD1338", "SF1624", "SF1625"],
  "SF1671": ["SF1624", "SF1625"],
  "SF1901": ["SF1671", "SF1626"],
  "EK1020": ["SF1624", "SF1625"],
  "II1301": ["DD1337", "SF1626"],
  "ID1212": ["DD1337"],
  "DH2402": ["SF1624", "SF1625", "SF1626"],
};

/** Mock prerequisites (list of course codes or labels). Replace with API/personal data when available. */
export function getMockPrerequisites(courseCode: string): string[] {
  const normalized = courseCode?.trim().toUpperCase();
  if (normalized && PREREQUISITES_BY_COURSE[normalized]) {
    return PREREQUISITES_BY_COURSE[normalized];
  }
  const mockOptions = [["None"], ["DD1337", "SF1626"], ["SF1626"], ["SF1624", "SF1625"]];
  const h = hash(courseCode);
  const idx = Math.floor(h * mockOptions.length) % mockOptions.length;
  const list = mockOptions[idx] ?? ["None"];
  return list.length ? list : ["None"];
}
