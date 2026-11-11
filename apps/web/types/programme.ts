/**
 * Programme facts for the study plan, as read from KTH's public programme
 * syllabi (utbildningsplaner) by `bun run ingest:programmes`.
 *
 * Shared by the server, which serves them, and the study plan, which checks a
 * plan against them. Every fact here comes from a kth.se page; nothing is
 * inferred beyond what the comment on each field says.
 */

/** KTH's degree types, as the programme directory groups them. */
export type ProgrammeType =
  | "CING" // civilingenjör, 300 hp
  | "TARKU" // arkitekt, 300 hp
  | "YHOGE" // högskoleingenjör, 180 hp
  | "GKAND" // kandidat, 180 hp
  | "TMAST" // master, 120 hp
  | "GMAGB" // magister, 60 hp
  | "TBAS" // tekniskt basår, no degree
  | "OTHER";

/** Basic (grundnivå), advanced (avancerad nivå) or preparatory (förberedande). */
export type CourseLevel = "B" | "A" | "P";

/** Obligatorisk, villkorligt valfri, rekommenderad, valfri, or a heading we don't know. */
export type PlanCategory = "O" | "VV" | "R" | "V" | "?";

export interface PlanRow {
  code: string;
  name: string;
  credits: number | null;
  level: CourseLevel;
  category: PlanCategory;
  /** The plan's track (h3) heading, or null for the courses common to everyone. */
  track: string | null;
  /** The plan's own remark under the course, e.g. "Endast en av …". */
  note: string;
}

export interface ProgrammeSummary {
  code: string;
  type: ProgrammeType;
  name: string;
  nameEn: string;
  credits: number;
  years: number;
  /** Admission terms with a published plan, newest first, e.g. "20242" = HT 2024. */
  intakes: string[];
  /**
   * The last intake, when KTH has published a newer intake for other
   * programmes of the same type but not this one, e.g. "20262".
   */
  lastAdmissionTerm: string | null;
  firstAdmissionTerm: string | null;
  /** Programmes KTH named as replacing this one, e.g. TCOMM → TSDSM, TICEM. */
  replacedBy: string[];
}

export interface ProgrammeIntake {
  term: string;
  /** Year number ("1".."5") → the plan's course list for that year. */
  years: Record<string, PlanRow[]>;
  /**
   * For years the intake's own plan doesn't list yet, the newer or older
   * intake whose list stands in, so the gap is visible rather than empty.
   */
  borrowedYears: Record<string, string>;
  /** Master's programmes with a guaranteed place (mappade), civilingenjör only. */
  mastersMapped: string[];
  /**
   * The mapped master's where the plan says the degree's subject requirement
   * needs an individual study plan with the programme director.
   */
  mastersIndividual: string[];
  /** Master's the plan names as open to apply to, without a guaranteed place. */
  mastersOpen: string[];
  /** "Endast en av …" sets: at most one of each may count toward the degree. */
  overlaps: string[][];
  /** Plan prose, trimmed: conditions for continuing, degree project, eligibility. */
  text: {
    conditions: string;
    degreeProject: string;
    eligibility: string;
  };
}

/** Credits per period of one round, index 0..5 = P0..P5 (P5 is summer). */
export type PeriodCredits = number[];

export interface ProgrammeDetail {
  summary: ProgrammeSummary;
  intakes: Record<string, ProgrammeIntake>;
  /**
   * Course → its rounds in this programme in the running academic year, as
   * the year pages list them. A course can have several (DH2642: P2 at 50 %
   * for one cohort, P3–P4 at 25 % in the catalogue).
   */
  rounds: Record<string, PeriodCredits[]>;
  /** The academic year `rounds` describe, e.g. 2026 for 2026/27. */
  roundsYear: number;
}

export type RequirementKind =
  | "course" // names areas, course codes or credit totals we can check
  | "degree" // a prior degree (kandidatexamen …): the 165 hp gate stands in for civilingenjörer
  | "english" // met by KTH admission
  | "recommended"
  | "note"; // anything else; shown verbatim, ticked by the student

export interface RequirementItem {
  /** KTH's sentence, verbatim. */
  text: string;
  kind: RequirementKind;
  /** Knowledge areas the sentence names, e.g. "Linjär algebra". */
  areas: string[];
  codes: string[];
  /** True when the codes are alternatives ("… eller …", "/"). */
  anyCode: boolean;
  /** Credit pools, e.g. 30 hp within Matematik. */
  totals: { credits: number; domains: string[] }[];
}

export interface CivingRequirement {
  /** The heading KTH puts over the list, e.g. "Obligatoriska kurser". */
  category: string;
  /** Any one of these meets the line. */
  codes: string[];
  text: string;
}

export interface MasterEligibility {
  code: string;
  name: string;
  /** The intake whose plan the requirements were read from. */
  term: string;
  items: RequirementItem[];
  /**
   * KTH's own course codes that make up the requirement for civilingenjör
   * students with a guaranteed place, per programme ("*" = every programme).
   */
  civing: {
    basis: string;
    /** The intake year the codes refer to; KTH says they can differ for others. */
    codesYear: number | null;
    sections: Record<string, CivingRequirement[]>;
  } | null;
  text: string;
}

export interface DegreeProjectGate {
  code: string;
  /** Credits that must be done first, as the course's eligibility states. */
  credits: number | null;
  advancedCredits: number | null;
  /** Credits from within the master's programme. */
  masterCredits: number | null;
  /** Needs the kandidat part done first (second-cycle projects in a civilingenjör plan). */
  needsBachelorPart: boolean;
  /** Needs a theory-of-science / research-methods course. */
  needsMethods: boolean;
  courses: string[];
  when: string | null;
  text: string;
}

export interface KnowledgeArea {
  name: string;
  /** Swedish course-title fragments that cover the area. */
  titles: string[];
}

/** One "satisfied by any of these" requirement read from a syllabus. */
export interface PrerequisiteGroup {
  codes: string[];
  /** "aktivt deltagande i X" lets X run alongside; otherwise X must be completed first. */
  strength: "completed" | "participating";
  /** An alternative names no course ("… eller 12 hp programvaruutveckling"), so it can't be ruled out. */
  open: boolean;
  /** None of the codes is in the catalogue, so nothing can satisfy it here. */
  unresolvable: boolean;
  /** The sentence it came from, verbatim. */
  text: string;
}

export interface CatalogueRound {
  startTerm: number;
  credits: PeriodCredits;
  /** KTH's study pace in percent, as the catalogue prints it. */
  pace: number | null;
  /** Open to students outside a programme (fristående). */
  isOpen: boolean;
}

/** What the study plan needs to know about one course. */
export interface CoursePlanFacts {
  code: string;
  titleSwe: string;
  titleEng: string;
  credits: number;
  level: CourseLevel;
  department: string;
  /** Catalogue rounds, from the last KOPPS ingest (2025/26). */
  rounds: CatalogueRound[];
  prerequisites: PrerequisiteGroup[];
  registeredCounts: boolean;
  eligibility: string;
}

export interface PlanFactsResult {
  courses: Record<string, CoursePlanFacts>;
  /** Swedish title and level of every code a prerequisite names, for same-course matching. */
  refs: Record<string, { titleSwe: string; level: CourseLevel }>;
}

/** A course round as the course's own kth.se page lists it for the running academic year. */
export interface CurrentRound {
  /** Start term, e.g. "20271" for spring 2027. */
  term: string;
  credits: PeriodCredits;
  /** KTH's study pace in percent. */
  pace: number | null;
  /** Programmes the round is part of, read from its "part of programme" links. */
  programmes: string[];
}
