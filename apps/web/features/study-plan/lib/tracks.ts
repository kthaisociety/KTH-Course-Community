import type { ProgrammeDetail } from "@/types/programme";

/**
 * Every English track name the given programmes know, keyed by the Swedish
 * heading. Merged across all their intakes: a year an intake borrows from
 * another intake shows tracks its own page never named.
 */
export function trackNamesIn(
  ...details: (ProgrammeDetail | null)[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of details)
    for (const intake of Object.values(d?.intakes ?? {}))
      Object.assign(out, intake.trackNames ?? {});
  return out;
}

/**
 * A track as the app shows it: KTH's English name where the ingest read one,
 * without the "Specialisations:" or "Inriktning:" that the field's own "Track"
 * label already says. The Swedish heading stays the key a plan saves.
 */
export function trackLabel(
  track: string,
  names: Readonly<Record<string, string>>,
): string {
  return (names[track] ?? track)
    .replace(
      /^(specialisations?|specializations?|tracks?|inriktning(ar)?)\s*:\s*/i,
      "",
    )
    .trim();
}
