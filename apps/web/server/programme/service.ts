import type {
  CurrentRound,
  DegreeProjectGate,
  KnowledgeArea,
  MasterEligibility,
  ProgrammeDetail,
  ProgrammeSummary,
  ProgrammeType,
} from "@/types/programme";
import * as programmeRepo from "./repository";

/** The order setup lists degree types in: the long programmes first. */
const TYPE_ORDER: ProgrammeType[] = [
  "CING",
  "TARKU",
  "YHOGE",
  "GKAND",
  "TMAST",
  "GMAGB",
  "TBAS",
  "OTHER",
];

export async function listProgrammes(): Promise<{
  roundsYear: number | null;
  programmes: ProgrammeSummary[];
}> {
  const index = await programmeRepo.findProgrammes();
  if (!index) return { roundsYear: null, programmes: [] };
  const programmes = [...index.programmes].sort(
    (a, b) =>
      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
      a.name.localeCompare(b.name, "sv") ||
      a.code.localeCompare(b.code),
  );
  return { roundsYear: index.roundsYear, programmes };
}

export function getProgramme(code: string): Promise<ProgrammeDetail | null> {
  return programmeRepo.findProgramme(code);
}

export async function getMasterRequirements(codes: string[]): Promise<{
  areas: KnowledgeArea[];
  masters: Record<string, MasterEligibility>;
}> {
  const file = await programmeRepo.findMasterEligibility();
  if (!file) return { areas: [], masters: {} };
  const wanted = new Set(codes);
  return {
    areas: file.areas,
    masters: Object.fromEntries(
      Object.entries(file.masters).filter(([code]) => wanted.has(code)),
    ),
  };
}

export async function getDegreeProjects(
  codes: string[],
): Promise<Record<string, DegreeProjectGate>> {
  const all = await programmeRepo.findDegreeProjects();
  if (!all) return {};
  return Object.fromEntries(
    codes.flatMap((c) => (all[c] ? [[c, all[c]]] : [])),
  );
}

/** This academic year's rounds of each course, as its kth.se page lists them. */
export async function getCurrentRounds(codes: string[]): Promise<{
  roundsYear: number | null;
  courses: Record<string, CurrentRound[]>;
}> {
  const file = await programmeRepo.findCurrentRounds();
  if (!file) return { roundsYear: null, courses: {} };
  return {
    roundsYear: file.roundsYear,
    courses: Object.fromEntries(
      codes.flatMap((c) => (file.courses[c] ? [[c, file.courses[c]]] : [])),
    ),
  };
}
