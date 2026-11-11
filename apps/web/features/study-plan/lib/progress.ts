import type {
  DegreeProjectGate,
  KnowledgeArea,
  MasterEligibility,
  PlanFactsResult,
  ProgrammeDetail,
  RequirementItem,
} from "@/types/programme";
import {
  type BuiltPlan,
  intakeOf,
  masterIntakeFor,
  type PlanItem,
} from "./build-plan";
import { makeSameCourse } from "./check-plan";
import type { PlanSetup } from "./plan-storage";
import {
  type Slot,
  slotIndex,
  slotLabel,
  studyYearOf,
  termLabel,
} from "./slots";

/**
 * What the side panel says about the student's progress, as data.
 *
 * A civilingenjör plan is three questions, asked in order, and the panel keeps
 * them apart so advanced-level credits never show up as a bachelor's
 * requirement: is the bachelor part on track (years 1–3, the kandidat project,
 * the 165 hp gate); will I get into the master's I want (its entry
 * requirements, from KTH's own text); and is the master's part on track (its
 * mandatory courses and the master's degree project).
 *
 * Every criterion is met, met by a plan (not yet passed), short, or something
 * the data can't check — and says which.
 */

export type CriterionState = "met" | "planned" | "short" | "unknown";

export interface Criterion {
  state: CriterionState;
  text: string;
  /** Verbatim requirement text, or how the number was worked out. */
  detail?: string;
  /** Course codes the criterion is about, for "show me" links. */
  codes?: string[];
  /** KTH's own page for this requirement, for the wording we don't reproduce. */
  href?: string;
}

export interface ProgressSection {
  id: "bachelor" | "eligibility" | "master" | "degree";
  title: string;
  subtitle: string;
  criteria: Criterion[];
  footnote?: string;
}

export interface ProgressInputs {
  setup: PlanSetup;
  plan: BuiltPlan;
  programme: ProgrammeDetail | null;
  master: ProgrammeDetail | null;
  eligibility: MasterEligibility | null;
  areas: KnowledgeArea[];
  projects: Record<string, DegreeProjectGate>;
  facts: PlanFactsResult;
  now: Slot;
}

const fmt = (n: number) =>
  (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");

interface Tally {
  done: number;
  planned: number;
}

function tally(
  items: readonly PlanItem[],
  keep: (i: PlanItem) => boolean,
): Tally {
  const t = { done: 0, planned: 0 };
  for (const i of items) {
    if (!i.counts || !keep(i)) continue;
    if (i.status === "passed") t.done += i.credits;
    else t.planned += i.credits;
  }
  return t;
}

function creditCriterion(
  t: Tally,
  need: number,
  label: string,
  detail?: string,
): Criterion {
  const total = t.done + t.planned;
  const state: CriterionState =
    t.done >= need ? "met" : total >= need ? "planned" : "short";
  const parts = [`${fmt(t.done)} passed`];
  if (t.planned) parts.push(`${fmt(t.planned)} planned`);
  return {
    state,
    text: `${label}: ${fmt(total)} of ${need} hp${state === "short" ? `, ${fmt(need - total)} short` : ""}`,
    detail: [parts.join(" · "), detail].filter(Boolean).join(". "),
  };
}

/** A rough subject for a course code, for credit pools like "30 hp matematik". Labelled as an estimate wherever shown. */
export function domainOf(code: string): string | null {
  const p = code.slice(0, 2);
  if (p === "SF") return "Matematik";
  if (["DD", "ID", "IK", "IS", "IV", "II", "DH", "DM", "DT"].includes(p))
    return "Data/IT";
  if (["EI", "EJ", "EK", "EL", "EP", "EQ", "ET", "EH", "IE", "IL"].includes(p))
    return "Elektroteknik";
  if (["SK", "SH", "SI"].includes(p)) return "Fysik";
  if (p.startsWith("K") || p === "CK") return "Kemi";
  if (["SE", "SG", "MF", "MJ", "MG", "MH", "MM"].includes(p))
    return "Maskin/Mekanik";
  return null;
}

const METHODS =
  /vetenskapsteori|forskningsmetod|vetenskaplig metod|research method|theory of science|scientific method/i;

export function computeProgress(inp: ProgressInputs): ProgressSection[] {
  const { plan, programme, setup, facts, projects } = inp;
  const type = programme?.summary.type ?? null;
  const isCiving = type === "CING";
  const sections: ProgressSection[] = [];
  const same = makeSameCourse(plan, facts);
  const startAy = plan.startAy;
  const studyYear = (i: PlanItem) =>
    startAy !== null && i.slot ? studyYearOf(i.slot.ay, startAy) : null;
  const titleSwe = (code: string) =>
    (
      plan.template.get(code)?.name ??
      facts.courses[code]?.titleSwe ??
      facts.refs[code]?.titleSwe ??
      ""
    ).toLowerCase();
  const all = [...plan.items, ...plan.unplaced];
  const titleEn = (code: string) =>
    facts.courses[code]?.titleEng ?? plan.template.get(code)?.name ?? code;

  /** Met if passed, planned if a counting placement ends before `dueIdx`. */
  const codeState = (codes: string[], dueIdx: number): CriterionState => {
    const hits = all.filter(
      (i) => i.counts && codes.some((c) => same(i.code, c)),
    );
    if (hits.some((i) => i.status === "passed")) return "met";
    if (hits.some((i) => i.endIdx < dueIdx)) return "planned";
    return "short";
  };

  if (startAy === null || !programme) return sections;

  const bachelorYears = isCiving ? 3 : type === "TMAST" ? 0 : plan.years;
  const mandatoryOf = (source: "programme" | "master") =>
    plan.mandatory.filter((m) => m.source === source);

  // ---- The bachelor part, or the whole programme for a three-year degree. ----
  if (bachelorYears > 0) {
    const crit: Criterion[] = [];
    const inBachelor = (i: PlanItem) =>
      i.taken !== null && i.slot === null
        ? true
        : (studyYear(i) ?? 99) <= bachelorYears;
    crit.push(
      creditCriterion(
        tally(all, inBachelor),
        180,
        `Credits, years 1–${bachelorYears}`,
        plan.unplaced.length
          ? `Includes ${plan.unplaced.length} taken course${plan.unplaced.length === 1 ? "" : "s"} you haven't placed yet`
          : undefined,
      ),
    );

    const mand = mandatoryOf("programme");
    const states = mand.map((m) => ({
      m,
      s: codeState([m.code], Number.POSITIVE_INFINITY),
    }));
    const missing = states.filter((x) => x.s === "short");
    crit.push({
      state: missing.length
        ? "short"
        : states.every((x) => x.s === "met")
          ? "met"
          : "planned",
      text: `Mandatory courses: ${states.filter((x) => x.s === "met").length} of ${mand.length} passed${missing.length ? `, ${missing.length} not in your plan or not passed` : ""}`,
      detail: missing.length
        ? missing.map((x) => `${x.m.code} ${titleEn(x.m.code)}`).join(" · ")
        : undefined,
      codes: missing.map((x) => x.m.code),
    });

    // The first-cycle degree project and the credits it needs first.
    const kex = mand.find((m) => /X$/.test(m.code) && m.level === "B");
    if (kex) {
      const gate = projects[kex.code];
      const placed = plan.items.find((i) => i.code === kex.code);
      if (placed?.status === "passed")
        crit.push({ state: "met", text: `Degree project ${kex.code}: passed` });
      else if (gate?.credits && placed) {
        const before = tally(
          all,
          (i) =>
            i !== placed && (i.slot === null || i.endIdx < placed.startIdx),
        );
        const c = creditCriterion(
          before,
          gate.credits,
          `Before ${kex.code} starts (${slotLabel(placed.segments[0].slot)})`,
          `${kex.code} needs ${gate.credits} hp of your programme's courses done first${gate.courses.length ? `, including ${gate.courses.join(", ")}` : ""}.`,
        );
        crit.push(c);
      } else
        crit.push({
          state: "unknown",
          text: `Degree project ${kex.code}${gate?.credits ? `: needs ${gate.credits} hp first` : ""}${placed ? "" : ". Place it to check"}`,
          detail:
            gate && !gate.credits
              ? "Its syllabus names no credit number: the examiner decides."
              : undefined,
        });
    }

    if (isCiving) {
      const due = slotIndex({ ay: startAy + 3, p: 1 });
      const conditions =
        intakeOf(programme, setup.intake)?.text.conditions ?? "";
      // Most plans say 110 hp from years 1–2; CTFYS, CTMAT and CFATE say 60 from year 1 and 50 from year 2.
      const split = /60 (hp|högskolepoäng) från (åk|årskurs) 1\b/i.test(
        conditions,
      );
      const yearsTo = (n: number) => (i: PlanItem) =>
        i.endIdx < due && (studyYear(i) ?? 99) <= n;
      const total = tally(
        all,
        (i) => (i.slot === null && i.taken !== null) || yearsTo(3)(i),
      );
      crit.push(
        creditCriterion(
          total,
          165,
          `Master's part: by ${termLabel({ ay: startAy + 3, p: 1 })}, from years 1–3`,
          split
            ? "KTH requires 165 hp from years 1–3, at least 60 of them from year 1 and 50 from year 2, before the master's part starts."
            : "KTH requires 165 hp from years 1–3, at least 110 of them from years 1–2, before the master's part starts.",
        ),
      );
      if (split) {
        crit.push(
          creditCriterion(
            tally(all, (i) => i.endIdx < due && studyYear(i) === 1),
            60,
            "Of those, from year 1",
          ),
        );
        crit.push(
          creditCriterion(
            tally(all, (i) => i.endIdx < due && studyYear(i) === 2),
            50,
            "Of those, from year 2",
          ),
        );
      } else
        crit.push(
          creditCriterion(
            tally(all, yearsTo(2)),
            110,
            "Of those, from years 1–2",
            plan.unplaced.length
              ? "Place your taken courses to count them here"
              : undefined,
          ),
        );
      if (kex) {
        const s = codeState([kex.code], due);
        crit.push({
          state: s,
          text: `Kandidat project ${kex.code} done before the master's starts`,
        });
      }
    }
    sections.push({
      id: "bachelor",
      title: isCiving
        ? "Bachelor part · years 1–3"
        : `${programme.summary.code} · years 1–${bachelorYears}`,
      subtitle: isCiving
        ? "Basic-level studies and the gate to the master's part"
        : `${fmt(programme.summary.credits)} hp degree`,
      criteria: crit,
    });
  }

  // ---- Getting into the master's. ----
  if (setup.master && inp.eligibility && type !== "TMAST") {
    const e = inp.eligibility;
    const due = isCiving
      ? slotIndex({ ay: startAy + 3, p: 1 })
      : Number.POSITIVE_INFINITY;
    const crit: Criterion[] = [];
    const civing = isCiving
      ? (e.civing?.sections[programme.summary.code] ??
        e.civing?.sections["*"] ??
        null)
      : null;
    if (civing && e.civing) {
      for (const r of civing)
        crit.push({
          state: codeState(r.codes, due),
          text: r.codes.map((c) => `${c} ${titleEn(c)}`).join(" or "),
          detail: categoryInEnglish(r.category),
          codes: r.codes,
        });
    } else {
      const before = all.filter(
        (i) => i.counts && (i.slot === null || i.endIdx < due),
      );
      const href = `https://www.kth.se/student/kurser/program/${e.code}/${e.term}/genomforande`;
      const seen = new Set<string>();
      for (const item of e.items) {
        const c = requirementCriterion(
          item,
          before,
          inp.areas,
          titleSwe,
          isCiving,
          href,
        );
        if (seen.has(c.text)) continue;
        seen.add(c.text);
        crit.push(c);
      }
    }
    const intake = intakeOf(programme, setup.intake);
    const mapped = intake?.mastersMapped.includes(setup.master) ?? false;
    const individual =
      intake?.mastersIndividual.includes(setup.master) ?? false;
    const status = isCiving
      ? mapped
        ? `Guaranteed place for ${programme.summary.code} students who meet the requirements${individual ? ". Course choices go through an individual study plan with the programme director" : ""}`
        : "Not mapped to your programme: you'd apply in open competition"
      : "You apply to the master's with your degree";
    sections.push({
      id: "eligibility",
      title: `Getting into ${setup.master}`,
      subtitle: status,
      criteria: crit,
      footnote:
        civing && e.civing
          ? `KTH's list for ${programme.summary.code} students${e.civing.codesYear ? `. The codes refer to the ${e.civing.codesYear} intake and can differ for others` : ""}.`
          : `Summarised from ${setup.master}'s entry requirements (${termLabel({ ay: Number(e.term.slice(0, 4)), p: 1 })} plan). Matching your courses to them is an estimate.`,
    });
  }

  const bachelorMandatory: CriterionState = (() => {
    const states = mandatoryOf("programme").map((m) =>
      codeState([m.code], Number.POSITIVE_INFINITY),
    );
    if (states.some((x) => x === "short")) return "short";
    return states.every((x) => x === "met") ? "met" : "planned";
  })();

  // ---- The master's part. ----
  const masterSource = isCiving
    ? "master"
    : type === "TMAST"
      ? "programme"
      : null;
  if (masterSource) {
    const mand = mandatoryOf(masterSource);
    const masterYear = (i: PlanItem) =>
      isCiving ? (studyYear(i) ?? 0) >= 4 : true;
    const crit: Criterion[] = [];
    if (isCiving && !setup.master)
      crit.push({
        state: "unknown",
        text: "Choose a master's in plan settings to fill years 4–5",
      });
    if (mand.length) {
      const states = mand.map((m) => ({
        m,
        s: codeState([m.code], Number.POSITIVE_INFINITY),
      }));
      const missing = states.filter((x) => x.s === "short");
      crit.push({
        state: missing.length
          ? "short"
          : states.every((x) => x.s === "met")
            ? "met"
            : "planned",
        text: `Mandatory courses: ${states.filter((x) => x.s === "met").length} of ${mand.length} passed`,
        detail: missing.length
          ? missing.map((x) => `${x.m.code} ${titleEn(x.m.code)}`).join(" · ")
          : undefined,
        codes: missing.map((x) => x.m.code),
      });
    }
    const advanced = tally(all, (i) => i.level === "A" && masterYear(i));
    crit.push(
      creditCriterion(
        advanced,
        90,
        isCiving ? "Advanced credits, years 4–5" : "Advanced credits",
      ),
    );
    const mex =
      mand.find((m) => /X$/.test(m.code) && m.level === "A") ??
      plan.items.find((i) => /X$/.test(i.code) && i.level === "A");
    if (mex) {
      const gate = projects[mex.code];
      const placed = plan.items.find((i) => i.code === mex.code);
      if (placed?.status === "passed")
        crit.push({ state: "met", text: `Degree project ${mex.code}: passed` });
      else if (placed && gate) {
        const before = (i: PlanItem) =>
          i !== placed && i.endIdx < placed.startIdx;
        if (gate.advancedCredits)
          crit.push(
            creditCriterion(
              tally(all, (i) => i.level === "A" && before(i)),
              gate.advancedCredits,
              `Advanced credits before ${mex.code} starts`,
              `${mex.code} needs ${gate.advancedCredits} hp of advanced courses done first.`,
            ),
          );
        if (gate.masterCredits)
          crit.push(
            creditCriterion(
              tally(all, (i) => masterYear(i) && before(i)),
              gate.masterCredits,
              `Master's credits before ${mex.code} starts`,
              `${mex.code} needs ${gate.masterCredits} hp from the master's programme done first.`,
            ),
          );
        if (gate.needsMethods) {
          const m = all.find(
            (i) =>
              i.counts &&
              before(i) &&
              (METHODS.test(i.title) || METHODS.test(titleSwe(i.code))),
          );
          crit.push({
            state: m ? (m.status === "passed" ? "met" : "planned") : "short",
            text: m
              ? `A research methods course first: ${m.code}`
              : "A theory-of-science and research methods course first",
          });
        }
        if (gate.needsBachelorPart && isCiving)
          crit.push({
            state: bachelorMandatory,
            text: "Every mandatory course of years 1–3 done first",
          });
      } else
        crit.push({
          state: "unknown",
          text: `Degree project ${mex.code}${placed ? "" : ": place it to check its requirements"}`,
        });
    }
    const masterName = isCiving ? setup.master : programme.summary.code;
    sections.push({
      id: "master",
      title: isCiving
        ? `Master's part · years 4–5${masterName ? ` · ${masterName}` : ""}`
        : `${programme.summary.code} · master's`,
      subtitle:
        isCiving && inp.master && setup.intake
          ? `${inp.master.summary.nameEn}, from its ${termLabel({ ay: Number(masterIntakeFor(setup.intake).slice(0, 4)), p: 1 })} plan`
          : "Advanced-level studies and the degree project",
      criteria: crit,
    });
  }

  // ---- The degree as a whole. ----
  const degreeCredits = programme.summary.credits;
  if (degreeCredits) {
    const crit = [
      creditCriterion(
        tally(all, () => true),
        degreeCredits,
        "All credits",
      ),
    ];
    if (isCiving || type === "TMAST")
      crit.push(
        creditCriterion(
          tally(all, (i) => i.level === "A"),
          90,
          "Advanced level",
        ),
      );
    sections.push({
      id: "degree",
      title: "The whole degree",
      subtitle: programme.summary.nameEn,
      criteria: crit,
      footnote:
        "From KTH's local degree ordinance. Subject requirements (maths and science, the main field) aren't tagged in any public data, so they aren't counted here.",
    });
  }
  return sections;
}

const CATEGORY_EN: [RegExp, string][] = [
  [/obligatorisk/i, "Mandatory in your programme"],
  [/villkorligt/i, "Conditionally elective in your programme"],
  [/valfri/i, "As an elective"],
];
function categoryInEnglish(category: string): string {
  return CATEGORY_EN.find(([re]) => re.test(category))?.[1] ?? "Required";
}

const AREA_EN: Record<string, string> = {
  Envariabelanalys: "single-variable calculus",
  Flervariabelanalys: "multivariable calculus",
  "Linjär algebra": "linear algebra",
  "Sannolikhetsteori och statistik": "probability and statistics",
  "Diskret matematik": "discrete mathematics",
  Differentialekvationer: "differential equations",
  "Numeriska metoder": "numerical methods",
  Programmering: "programming",
  "Objektorienterad programmering": "object-oriented programming",
  "Algoritmer och datastrukturer": "algorithms and data structures",
  "Algoritmisk komplexitet": "algorithmic complexity",
  "Signaler och system": "signals and systems",
  Reglerteknik: "control engineering",
  Elektroteknik: "electrical circuits",
  Datorteknik: "computer engineering",
  Mekanik: "mechanics",
  Hållfasthetslära: "solid mechanics",
  Termodynamik: "thermodynamics",
  "Industriell ekonomi": "industrial economics",
  "Människa–datorinteraktion": "human–computer interaction",
};
const DOMAIN_EN: Record<string, string> = {
  Matematik: "mathematics",
  "Data/IT": "computing",
  Elektroteknik: "electrical engineering",
  Fysik: "physics",
  Kemi: "chemistry",
  "Maskin/Mekanik": "mechanical engineering",
};
const areaEn = (a: string) => AREA_EN[a] ?? a;
const listEn = (xs: string[], joiner: "and" | "or") =>
  xs.length <= 1
    ? (xs[0] ?? "")
    : `${xs.slice(0, -1).join(", ")} ${joiner} ${xs.at(-1)}`;
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * One line of a master's entry requirements, in short English. KTH's text is
 * Swedish prose; this says what was read out of it, and links to KTH's page
 * for anything it can't restate.
 */
function requirementCriterion(
  item: RequirementItem,
  courses: PlanItem[],
  areas: KnowledgeArea[],
  titleSwe: (code: string) => string,
  isCiving: boolean,
  href: string,
): Criterion {
  if (item.kind === "english")
    return {
      state: "met",
      text: "English 6",
      detail: "Met by your admission to KTH",
    };
  if (item.kind === "degree")
    return {
      state: "unknown",
      text: "A bachelor's degree (180 hp)",
      detail: isCiving
        ? "For a civilingenjör student, the 165 hp gate to the master's part stands in for this"
        : undefined,
    };
  if (item.kind === "recommended")
    return {
      state: "unknown",
      text: "A recommendation, not a requirement",
      detail: "Read KTH's wording for what it suggests",
      href,
    };
  if (item.kind === "note")
    return {
      state: "unknown",
      text: "Another requirement we can't check",
      detail: "Read KTH's wording and check it yourself",
      href,
    };
  const parts: { ok: CriterionState; label: string }[] = [];
  const stateOf = (hits: PlanItem[]): CriterionState =>
    hits.some((h) => h.status === "passed")
      ? "met"
      : hits.length
        ? "planned"
        : "short";
  const said: string[] = [];
  if (item.codes.length) {
    const hits = courses.filter((c) => item.codes.includes(c.code));
    parts.push({
      ok: stateOf(hits),
      label: item.codes.join(item.anyCode ? " or " : ", "),
    });
    said.push(
      item.anyCode
        ? `one of ${listEn(item.codes, "or")}`
        : listEn(item.codes, "and"),
    );
  }
  for (const name of item.areas) {
    const fragments = areas.find((a) => a.name === name)?.titles ?? [
      name.toLowerCase(),
    ];
    const hits = courses.filter((c) =>
      fragments.some((f) => titleSwe(c.code).includes(f)),
    );
    parts.push({
      ok: stateOf(hits),
      label: hits.length
        ? `${areaEn(name)} (${hits.map((h) => h.code).join(", ")})`
        : areaEn(name),
    });
  }
  if (item.areas.length)
    said.push(`courses in ${listEn(item.areas.map(areaEn), "and")}`);
  for (const t of item.totals) {
    const hits = courses.filter((c) =>
      t.domains.includes(domainOf(c.code) ?? ""),
    );
    const done = hits
      .filter((h) => h.status === "passed")
      .reduce((a, h) => a + h.credits, 0);
    const sum = hits.reduce((a, h) => a + h.credits, 0);
    const where = listEn(
      t.domains.map((d) => DOMAIN_EN[d] ?? d),
      "or",
    );
    parts.push({
      ok: done >= t.credits ? "met" : sum >= t.credits ? "planned" : "short",
      label: `${fmt(sum)} of ${t.credits} hp in ${where} (estimate)`,
    });
    said.push(`${t.credits} hp in ${where}`);
  }
  const state: CriterionState = parts.some((p) => p.ok === "short")
    ? "short"
    : parts.some((p) => p.ok === "planned")
      ? "planned"
      : "met";
  return {
    state,
    text: capital(listEn(said, "and")),
    detail: parts
      .map(
        (p) =>
          `${p.ok === "met" ? "✓" : p.ok === "planned" ? "◔" : "✗"} ${p.label}`,
      )
      .join(" · "),
    href,
  };
}
