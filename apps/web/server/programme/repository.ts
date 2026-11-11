import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  CurrentRound,
  DegreeProjectGate,
  KnowledgeArea,
  MasterEligibility,
  ProgrammeDetail,
  ProgrammeSummary,
} from "@/types/programme";

/**
 * The programme data `bun run ingest:programmes` writes from kth.se.
 *
 * It is files, not tables: the study plan launched while the schema was
 * frozen, and the data is public, versioned with the code, and regenerated
 * rather than edited. `next.config.ts` traces this folder into the standalone
 * build, because nothing imports these files statically.
 */
const DATA_DIR = path.join(process.cwd(), "server/programme/data");

const cache = new Map<string, Promise<unknown>>();

function load<T>(file: string): Promise<T | null> {
  let hit = cache.get(file);
  if (!hit) {
    hit = readFile(path.join(DATA_DIR, file), "utf8")
      .then((text) => JSON.parse(text) as unknown)
      .catch(() => {
        // A missing file stays missing only until the ingest writes it: don't remember the miss.
        cache.delete(file);
        return null;
      });
    cache.set(file, hit);
  }
  return hit as Promise<T | null>;
}

export async function findProgrammes(): Promise<{
  roundsYear: number;
  programmes: ProgrammeSummary[];
} | null> {
  return load("programmes.json");
}

/** Codes come from the index, never the caller, so this cannot read outside the folder. */
export async function findProgramme(
  code: string,
): Promise<ProgrammeDetail | null> {
  const index = await findProgrammes();
  if (!index?.programmes.some((p) => p.code === code)) return null;
  return load(`plans/${code}.json`);
}

export async function findMasterEligibility(): Promise<{
  areas: KnowledgeArea[];
  masters: Record<string, MasterEligibility>;
} | null> {
  return load("masters.json");
}

export async function findDegreeProjects(): Promise<Record<
  string,
  DegreeProjectGate
> | null> {
  const file = await load<{ projects: Record<string, DegreeProjectGate> }>(
    "degree-projects.json",
  );
  return file?.projects ?? null;
}

export async function findCurrentRounds(): Promise<{
  roundsYear: number;
  courses: Record<string, CurrentRound[]>;
} | null> {
  return load("rounds.json");
}
