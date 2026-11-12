import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CurrentRound,
  DegreeProjectGate,
  MasterEligibility,
  PeriodCredits,
  PlanRow,
  ProgrammeDetail,
  ProgrammeIntake,
  ProgrammeSummary,
  ProgrammeType,
} from "@/types/programme";
import { plainText } from "../../text/html";
import {
  fetchHtml,
  fetchStore,
  KTH_BASE,
  mapPolitely,
  type Store,
} from "./kth-page";
import { parseCourseRounds } from "./parse-course-rounds";
import { degreeProjectGate, specialEligibility } from "./parse-degree-project";
import {
  civingRequirements,
  KNOWLEDGE_AREAS,
  requirementItems,
} from "./parse-eligibility";
import { mastersOf, overlapsOf, parseCourseList } from "./parse-plan";

/**
 * Builds the study plan's programme data from kth.se and writes it as JSON
 * under `server/programme/data/`, which the programme domain serves.
 *
 * Read-only and public: the programme directory, each programme's syllabus
 * per intake, the year pages of the running academic year (the only ones
 * that carry periods), and the eligibility of every degree-project course.
 */

/**
 * Replacements KTH has announced but no page encodes as data.
 * Source: KTH's notice "Masterprogram 2027": TSDSM and TICEM open HT 2027;
 * TCOMM, TSEDM and TINNM take their last students in HT 2026.
 */
const REPLACED_BY: Record<string, string[]> = {
  TCOMM: ["TSDSM", "TICEM"],
  TSEDM: ["TSDSM", "TICEM"],
  TINNM: ["TSDSM", "TICEM"],
};

const TYPES = new Set<ProgrammeType>([
  "CING",
  "TARKU",
  "YHOGE",
  "GKAND",
  "TMAST",
  "GMAGB",
  "TBAS",
]);

export interface BuildOptions {
  outDir: string;
  /** Autumn of the running academic year: 2026 for 2026/27. */
  runningYear: number;
  /** Optional folder that keeps fetched pages, so a re-run doesn't refetch. */
  cacheDir?: string;
  log?: (line: string) => void;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asRecord = (v: unknown): Store =>
  v && typeof v === "object" ? (v as Store) : {};

async function cached<T>(
  url: string,
  kind: string,
  fetcher: (url: string) => Promise<T | null>,
  cacheDir?: string,
): Promise<T | null> {
  if (!cacheDir) return fetcher(url);
  const file = path.join(
    cacheDir,
    `${url.replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "_")}.${kind}.json`,
  );
  try {
    return JSON.parse(await readFile(file, "utf8")) as T | null;
  } catch {
    const value = await fetcher(url);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify(value));
    return value;
  }
}

interface DirectoryEntry {
  code: string;
  type: ProgrammeType;
  name: string;
  nameEn: string;
  credits: number;
  firstAdmissionTerm: string | null;
}

function directoryOf(store: Store): DirectoryEntry[] {
  const out: DirectoryEntry[] = [];
  for (const group of asArray(store.programmes)) {
    const [type, lists] = asArray(group) as [string, Store];
    if (!TYPES.has(type as ProgrammeType)) continue;
    for (const p of asArray(asRecord(lists).first)) {
      const e = asRecord(p);
      out.push({
        code: str(e.programmeCode),
        type: type as ProgrammeType,
        name: str(e.title),
        nameEn: str(e.titleOtherLanguage),
        credits: Number(e.credits) || 0,
        firstAdmissionTerm: str(e.firstAdmissionTerm) || null,
      });
    }
  }
  return out;
}

function intakeOf(
  store: Store,
  term: string,
  masterNames: Map<string, string>,
): ProgrammeIntake {
  const sp = asRecord(store.studyProgramme);
  const years: Record<string, PlanRow[]> = {};
  for (const [key, value] of Object.entries(sp)) {
    const m = key.match(/^kurslistaar(\d+)$/);
    if (m) years[m[1]] = parseCourseList(str(value));
  }
  const prose = [
    "utbildningensOmfattningOchInnehall",
    "utbildningensupplagg",
    "kurser",
  ]
    .map((k) => plainText(str(sp[k])))
    .concat(
      Object.entries(sp)
        .filter(([k]) => /^(infoVvkurser|arskursinformation)/.test(k))
        .map(([, v]) => plainText(str(v))),
    )
    .join("\n");
  const masters = mastersOf(prose, masterNames);
  return {
    term,
    years,
    borrowedYears: {},
    mastersMapped: masters.mapped,
    mastersIndividual: masters.individual,
    mastersOpen: masters.open,
    overlaps: overlapsOf(Object.values(years).flat()),
    text: {
      conditions: plainText(str(sp.villkorForDeltagande)).slice(0, 4000),
      degreeProject: plainText(str(sp.examensarbete)).slice(0, 3000),
      eligibility: plainText(str(sp.behorighetOchUrval)).slice(0, 6000),
    },
  };
}

/** Years an intake's own plan doesn't list yet borrow the nearest intake's list, older first. */
function fillYears(intakes: Record<string, ProgrammeIntake>, years: number) {
  const terms = Object.keys(intakes).sort();
  for (const term of terms) {
    const intake = intakes[term];
    for (let y = 1; y <= years; y++) {
      const key = String(y);
      if (intake.years[key]?.length) continue;
      const donor = [...terms]
        .filter(
          (t) =>
            t !== term &&
            intakes[t].years[key]?.length &&
            !intakes[t].borrowedYears[key],
        )
        .sort(
          (a, b) =>
            Math.abs(Number(a) - Number(term)) -
              Math.abs(Number(b) - Number(term)) || Number(a) - Number(b),
        )[0];
      if (donor) {
        intake.years[key] = intakes[donor].years[key];
        intake.borrowedYears[key] = donor;
      }
    }
  }
}

/** Year page participations → course rounds with credits per period. */
function roundsOf(store: Store | null): [string, PeriodCredits][] {
  const out: [string, PeriodCredits][] = [];
  for (const info of asArray(asRecord(store).curriculumInfos)) {
    for (const parts of Object.values(
      asRecord(asRecord(info).participations),
    )) {
      for (const p of asArray(parts)) {
        const course = asRecord(asRecord(p).course);
        const cpp = asArray(asRecord(p).creditsPerPeriod).map(Number);
        if (str(course.courseCode) && cpp.length === 6)
          out.push([str(course.courseCode), cpp]);
      }
    }
  }
  return out;
}

export async function buildProgrammeData(opts: BuildOptions) {
  const log = opts.log ?? (() => {});
  const get = (url: string) => cached(url, "store", fetchStore, opts.cacheDir);
  const getHtml = (url: string) =>
    cached(url, "html", fetchHtml, opts.cacheDir);

  const directoryStore = await get(`${KTH_BASE}/kurser-inom-program`);
  if (!directoryStore)
    throw new Error("kth.se programme directory did not load");
  const directory = directoryOf(directoryStore);
  log(`directory: ${directory.length} programmes`);
  const masterNames = new Map(
    directory
      .filter((d) => d.type === "TMAST")
      .map((d) => [d.name.toLowerCase(), d.code]),
  );

  const mains = await mapPolitely(directory, 6, async (d) => {
    const s = await get(`${KTH_BASE}/program/${encodeURIComponent(d.code)}`);
    return {
      terms: asArray(s?.programmeTerms).map(String),
      years: Number(s?.lengthInStudyYears) || 0,
      last: str(s?.lastAdmissionTerm) || null,
    };
  });
  // The oldest cohort still inside a five-year programme.
  const oldest = `${opts.runningYear - 5}2`;
  const newest = `${opts.runningYear + 1}2`;
  // The newest intake KTH has published for each type: a programme whose own newest is older has stopped admitting.
  const newestOfType = new Map<ProgrammeType, string>();
  directory.forEach((d, i) => {
    const top = [...mains[i].terms].sort().at(-1);
    if (top && top > (newestOfType.get(d.type) ?? ""))
      newestOfType.set(d.type, top);
  });
  const summaries: ProgrammeSummary[] = directory.map((d, i) => {
    const own = [...mains[i].terms].sort().at(-1) ?? null;
    // Compare years, not terms: a spring-only intake (20271) is as current as an autumn one (20272).
    const stopped =
      own && own.slice(0, 4) < (newestOfType.get(d.type) ?? "").slice(0, 4)
        ? own
        : null;
    return {
      code: d.code,
      type: d.type,
      name: d.name,
      nameEn: d.nameEn,
      credits: d.credits,
      years: mains[i].years || Math.max(1, Math.round(d.credits / 60)),
      intakes: mains[i].terms
        .filter((t) => t >= oldest && t <= newest)
        .sort()
        .reverse(),
      lastAdmissionTerm: mains[i].last ?? stopped,
      firstAdmissionTerm: d.firstAdmissionTerm,
      replacedBy: REPLACED_BY[d.code] ?? [],
    };
  });

  const planJobs = summaries.flatMap((s) =>
    s.intakes.map((term) => ({ s, term })),
  );
  log(`plans: ${planJobs.length} pages`);
  const plans = await mapPolitely(planJobs, 6, async ({ s, term }) => ({
    code: s.code,
    term,
    store: await get(
      `${KTH_BASE}/program/${encodeURIComponent(s.code)}/${term}/genomforande`,
    ),
  }));

  // Year N of a programme in the running year is studied by the cohort admitted N-1 years ago.
  const yearJobs = summaries.flatMap((s) =>
    Array.from({ length: s.years }, (_, i) => i + 1).flatMap((n) =>
      [`${opts.runningYear - (n - 1)}2`, `${opts.runningYear - (n - 1) + 1}1`]
        .filter((t) => s.intakes.includes(t))
        .map((term) => ({ code: s.code, n, term })),
    ),
  );
  log(`year pages: ${yearJobs.length}`);
  const yearPages = await mapPolitely(yearJobs, 6, async (j) => ({
    ...j,
    rounds: roundsOf(
      await get(
        `${KTH_BASE}/program/${encodeURIComponent(j.code)}/${j.term}/arskurs${j.n}`,
      ),
    ),
  }));

  const details: Record<string, ProgrammeDetail> = {};
  for (const s of summaries) {
    const intakes: Record<string, ProgrammeIntake> = {};
    for (const p of plans)
      if (p.code === s.code && p.store)
        intakes[p.term] = intakeOf(p.store, p.term, masterNames);
    fillYears(intakes, s.years);
    const rounds: Record<string, PeriodCredits[]> = {};
    for (const page of yearPages.filter((y) => y.code === s.code))
      for (const [course, cpp] of page.rounds) {
        rounds[course] = rounds[course] ?? [];
        const list = rounds[course];
        if (!list.some((r) => r.join() === cpp.join())) list.push(cpp);
      }
    details[s.code] = {
      summary: s,
      intakes,
      rounds,
      roundsYear: opts.runningYear,
    };
  }

  const masters: Record<string, MasterEligibility> = {};
  for (const s of summaries.filter((x) => x.type === "TMAST")) {
    const withText = Object.values(details[s.code].intakes)
      .filter((i) => i.text.eligibility)
      .sort((a, b) => b.term.localeCompare(a.term))[0];
    if (!withText) continue;
    const raw = plans.find(
      (p) => p.code === s.code && p.term === withText.term,
    )?.store;
    // Line structure matters here, so read the raw HTML rather than the trimmed text.
    const text = plainText(
      str(asRecord(raw?.studyProgramme).behorighetOchUrval),
    );
    masters[s.code] = {
      code: s.code,
      name: s.name,
      term: withText.term,
      items: requirementItems(text),
      civing: civingRequirements(text),
      text,
    };
  }

  // Every course any syllabus lists: its own page gives this year's rounds, and a degree project's bar.
  const courseCodes = [
    ...new Set(
      Object.values(details).flatMap((d) =>
        Object.values(d.intakes).flatMap((i) =>
          Object.values(i.years)
            .flat()
            .map((r) => r.code),
        ),
      ),
    ),
  ]
    .filter((c) => /^[A-Z]{2}\d{3}[0-9A-Z]$/.test(c))
    .sort();
  log(`course pages: ${courseCodes.length}`);
  const coursePages = await mapPolitely(courseCodes, 6, async (code) => {
    // Course pages are rendered on the server; the rounds sit in their embedded data, the rest in the text.
    const html = await getHtml(`${KTH_BASE}/kurs/${code}`);
    return {
      code,
      rounds: html ? parseCourseRounds(html) : [],
      eligibility:
        html && /X$/.test(code) ? specialEligibility(plainText(html)) : "",
    };
  });
  const projects: Record<string, DegreeProjectGate> = {};
  const currentRounds: Record<string, CurrentRound[]> = {};
  for (const { code, rounds, eligibility } of coursePages) {
    if (eligibility) projects[code] = degreeProjectGate(code, eligibility);
    if (rounds.length) currentRounds[code] = rounds;
  }

  const dataDir = opts.outDir;
  await mkdir(path.join(dataDir, "plans"), { recursive: true });
  const generatedAt = new Date().toISOString();
  await writeFile(
    path.join(dataDir, "programmes.json"),
    `${JSON.stringify({ generatedAt, roundsYear: opts.runningYear, programmes: summaries })}\n`,
  );
  for (const [code, d] of Object.entries(details))
    await writeFile(
      path.join(dataDir, "plans", `${code}.json`),
      `${JSON.stringify(d)}\n`,
    );
  await writeFile(
    path.join(dataDir, "masters.json"),
    `${JSON.stringify({ generatedAt, areas: KNOWLEDGE_AREAS, masters })}\n`,
  );
  await writeFile(
    path.join(dataDir, "rounds.json"),
    `${JSON.stringify({ generatedAt, roundsYear: opts.runningYear, courses: currentRounds })}
`,
  );
  await writeFile(
    path.join(dataDir, "degree-projects.json"),
    `${JSON.stringify({ generatedAt, projects })}\n`,
  );
  log(
    `wrote ${summaries.length} programmes, ${Object.values(details).reduce((a, d) => a + Object.keys(d.intakes).length, 0)} plans, ${Object.keys(masters).length} master's requirements, ${Object.keys(projects).length} degree-project gates, rounds for ${Object.keys(currentRounds).length} courses`,
  );
}
