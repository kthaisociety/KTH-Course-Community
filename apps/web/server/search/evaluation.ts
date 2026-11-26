export type EvaluationCourse = {
  code: string;
  department: string;
  titleEng: string | null;
  titleSwe: string | null;
  goals: string | null;
  content: string | null;
};

export type EvaluationCategory = "code" | "title" | "topic";

export type EvaluationQuery = {
  courseCode: string;
  courseTitle: string;
  category: EvaluationCategory;
  query: string;
};

export type EvaluationHit = { courseCode: string };

export type GeneratedTopicQuery = {
  courseCode: string;
  query: string;
};

export type EvaluationResult = EvaluationQuery & {
  rank: number | null;
  score: number;
};

const STOP_WORDS = new Set(
  "a about after all also an and are as at be by course courses for from in into is it of on or that the their this to with och av att den det en ett från för i med och om på som till är".split(
    " ",
  ),
);
function tokens(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? [];
}

function informativeTokens(value: string): string[] {
  return tokens(value).filter((token) => !STOP_WORDS.has(token.toLowerCase()));
}

export function buildEvaluationQueries(
  course: EvaluationCourse,
  topicQuery: string,
): EvaluationQuery[] {
  const title =
    course.titleEng?.trim() || course.titleSwe?.trim() || course.code;
  const titleTokens = tokens(title);
  let shortTitle = "";
  for (let index = 0; index < titleTokens.length - 1; index += 1) {
    const pair = titleTokens.slice(index, index + 2);
    if (pair.every((token) => !STOP_WORDS.has(token.toLowerCase()))) {
      shortTitle = pair.join(" ");
      break;
    }
  }
  if (!shortTitle) {
    shortTitle = informativeTokens(title).slice(0, 2).join(" ");
  }
  const partialCode = course.code.slice(0, Math.max(1, course.code.length - 2));
  return [
    {
      courseCode: course.code,
      courseTitle: title,
      category: "code",
      query: course.code,
    },
    {
      courseCode: course.code,
      courseTitle: title,
      category: "code",
      query: partialCode,
    },
    {
      courseCode: course.code,
      courseTitle: title,
      category: "title",
      query: shortTitle || title,
    },
    {
      courseCode: course.code,
      courseTitle: title,
      category: "topic",
      query: topicQuery,
    },
  ];
}

export function parseGeneratedTopicQueries(
  response: string,
  courses: readonly EvaluationCourse[],
): Map<string, string> {
  const start = response.indexOf("[");
  const end = response.lastIndexOf("]");
  if (start < 0 || end <= start) {
    throw new Error("Topic-query model did not return a JSON array");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.slice(start, end + 1));
  } catch {
    throw new Error("Topic-query model returned invalid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Topic-query model response must be an array");
  }

  const queries = new Map<string, string>();
  for (const row of parsed) {
    if (
      !row ||
      typeof row !== "object" ||
      !("index" in row) ||
      typeof row.index !== "number" ||
      !("query" in row) ||
      typeof row.query !== "string"
    ) {
      throw new Error("Topic-query model returned a malformed row");
    }
    const index = row.index;
    const query = row.query.trim();
    if (!Number.isInteger(index) || index < 1 || index > courses.length) {
      throw new Error(
        `Topic-query model returned invalid course index ${index}`,
      );
    }
    if (queries.has(courses[index - 1].code)) {
      throw new Error(`Topic-query model repeated course index ${index}`);
    }
    if (!query || query.length > 160) {
      throw new Error(
        `Topic-query model returned an invalid query for course index ${index}`,
      );
    }
    queries.set(courses[index - 1].code, query);
  }

  if (queries.size !== courses.length) {
    const missing = courses
      .filter((course) => !queries.has(course.code))
      .map((course) => course.code);
    throw new Error(`Topic-query model omitted courses: ${missing.join(", ")}`);
  }
  return queries;
}

/** Mulberry32: small, repeatable PRNG for a fixed course sample. */
function randomForSeed(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleCourses<T>(
  courses: readonly T[],
  count: number,
  seed: number,
): T[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("Sample count must be a non-negative integer");
  }

  const shuffled = [...courses];
  const random = randomForSeed(seed);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

/** Proportionally sample each department while including every one when possible. */
export function sampleCoursesStratified<T extends { department: string }>(
  courses: readonly T[],
  count: number,
  seed: number,
): T[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("Sample count must be a non-negative integer");
  }
  if (count > courses.length) {
    throw new RangeError("Sample count cannot exceed the course population");
  }

  const groups = new Map<string, T[]>();
  for (const course of courses) {
    const department = course.department.trim() || "Unspecified";
    const group = groups.get(department) ?? [];
    group.push(course);
    groups.set(department, group);
  }
  if (groups.size > count) {
    throw new RangeError(
      `Cannot include all ${groups.size} departments in a sample of ${count}`,
    );
  }

  const quotas = new Map([...groups.keys()].map((name) => [name, 1]));
  let remaining = count - groups.size;
  while (remaining > 0) {
    const eligible = [...groups.entries()].filter(
      ([name, group]) => (quotas.get(name) ?? 0) < group.length,
    );
    const eligiblePopulation = eligible.reduce(
      (total, [, group]) => total + group.length,
      0,
    );
    const allocations = eligible.map(([name, group]) => {
      const ideal = (remaining * group.length) / eligiblePopulation;
      const seats = Math.min(
        group.length - (quotas.get(name) ?? 0),
        Math.floor(ideal),
      );
      return { name, fraction: ideal - Math.floor(ideal), seats };
    });
    let assigned = 0;
    for (const allocation of allocations) {
      if (allocation.seats > 0) {
        quotas.set(
          allocation.name,
          (quotas.get(allocation.name) ?? 0) + allocation.seats,
        );
        assigned += allocation.seats;
      }
    }
    remaining -= assigned;
    if (remaining === 0) break;

    allocations.sort(
      (left, right) =>
        right.fraction - left.fraction || left.name.localeCompare(right.name),
    );
    let remainderAssigned = 0;
    for (const allocation of allocations) {
      if (remaining === 0) break;
      const quota = quotas.get(allocation.name) ?? 0;
      if (quota >= (groups.get(allocation.name)?.length ?? 0)) continue;
      quotas.set(allocation.name, quota + 1);
      remaining -= 1;
      remainderAssigned += 1;
    }
    if (assigned === 0 && remainderAssigned === 0) {
      throw new Error("Unable to allocate the requested stratified sample");
    }
  }

  const result: T[] = [];
  for (const [department, group] of groups) {
    let departmentSeed = seed;
    for (const character of department) {
      departmentSeed = Math.imul(
        departmentSeed ^ character.charCodeAt(0),
        16777619,
      );
    }
    result.push(
      ...sampleCourses(group, quotas.get(department) ?? 0, departmentSeed),
    );
  }
  return result;
}

export function reciprocalLogScore(rank: number | null): number {
  return rank === null || rank < 1 ? 0 : 1 / Math.log2(rank + 1);
}

export function rankTarget(
  targetCourseCode: string,
  hits: readonly EvaluationHit[],
): number | null {
  const index = hits.findIndex(
    (hit) => hit.courseCode.toUpperCase() === targetCourseCode.toUpperCase(),
  );
  return index < 0 ? null : index + 1;
}

export function averageScoresByCategory(
  results: readonly EvaluationResult[],
): Record<EvaluationCategory, number> {
  const categories: EvaluationCategory[] = ["code", "title", "topic"];
  return Object.fromEntries(
    categories.map((category) => {
      const categoryResults = results.filter(
        (result) => result.category === category,
      );
      const average = categoryResults.length
        ? categoryResults.reduce((total, result) => total + result.score, 0) /
          categoryResults.length
        : 0;
      return [category, average];
    }),
  ) as Record<EvaluationCategory, number>;
}
