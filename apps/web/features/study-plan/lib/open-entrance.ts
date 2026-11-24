import type { ProgrammeDetail } from "@/types/programme";
import { intakeOf } from "./build-plan";

/**
 * A civilingenjör programme whose syllabus covers year 1 only, like Öppen
 * ingång (COPEN): during that year the student applies for the civilingenjör
 * programme of the four years after it. Told apart by its data, not its code.
 */
export function isOpenEntrance(
  detail: ProgrammeDetail | null,
  intake: string | null,
): boolean {
  if (!detail || detail.summary.type !== "CING") return false;
  const years = Object.keys(intakeOf(detail, intake)?.years ?? {});
  return years.length > 0 && years.every((y) => y === "1");
}

/**
 * One programme an open-entrance student actually follows: the open entrance's
 * year 1, then the chosen programme's years 2 onward, from the chosen
 * programme's syllabus for the same intake. Everything that depends on the
 * programme — its master's mapping, the 110 hp gate, its tracks — is the
 * chosen programme's, because that is the degree the student ends up in.
 */
export function withContinuation(
  open: ProgrammeDetail,
  next: ProgrammeDetail,
  intake: string,
): ProgrammeDetail {
  const first = intakeOf(open, intake);
  const rest = intakeOf(next, intake);
  if (!first || !rest) return open;
  const years = {
    ...Object.fromEntries(
      Object.entries(rest.years).filter(([y]) => y !== "1"),
    ),
    "1": first.years["1"] ?? [],
  };
  return {
    ...next,
    intakes: {
      [intake]: {
        ...rest,
        term: intake,
        years,
        overlaps: [...first.overlaps, ...rest.overlaps],
      },
    },
    // Year 1's courses run on the open entrance's schedule.
    rounds: { ...next.rounds, ...open.rounds },
  };
}
