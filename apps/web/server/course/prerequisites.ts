import type { PrerequisiteGroup } from "@/types/programme";
import { plainText } from "../text/html";

/**
 * A syllabus's eligibility prose → prerequisite groups, read on request.
 *
 * `course_prerequisites` is empty and cannot say "or", and a planner needs
 * "or": most groups have alternatives. So each clause naming course codes
 * becomes one group, met by any of its codes. Grouping is permissive on
 * purpose — a false warning costs the student's trust in every warning.
 * See prerequisites.spec.ts for each rule.
 */

const CODE = /\b[A-Z]{2}\d{3}[0-9A-Z]\b/g;
/** "DD1310-DD1318": a range of codes, expanded against the catalogue. */
const RANGE = /\b([A-Z]{2})(\d{3}[0-9A-Z])\s*[-–]\s*\1(\d{3}[0-9A-Z])\b/g;
/** Ladok's sentence saying a running course counts as completed. */
const REGISTERED =
  /ännu inte är (ladok)?rapporterad|jämställs med slutförd|den som är registrerad anses|med slutexamination avses/i;

export interface PrerequisiteReading {
  groups: PrerequisiteGroup[];
  /** The syllabus says a course still running counts as completed (Ladok sentence). */
  registeredCounts: boolean;
  text: string;
}

function expandRanges(
  clause: string,
  catalogue: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const m of clause.matchAll(RANGE)) {
    const [, prefix, from, to] = m;
    for (const code of catalogue)
      if (
        code.startsWith(prefix) &&
        code.slice(2) >= from &&
        code.slice(2) <= to
      )
        out.push(code);
  }
  return out;
}

/** An "eller"/"alternativt" route that names no course and is more than "motsvarande". */
function hasUncheckableRoute(clause: string): boolean {
  if (/t\.\s?ex\.|till exempel|exempelvis|e\.g\./i.test(clause)) return true;
  const routes = clause.split(/\beller\b|\balternativt\b/i);
  if (routes.length < 2) return false;
  return routes.some((r) => {
    if (r.match(CODE)) return false;
    const words = r
      .replace(
        /motsvarande|kunskaper|i|om|minst|\d+(,\d)?\s*hp|[.,;:()]/gi,
        " ",
      )
      .trim();
    return words.length > 12;
  });
}

export function readPrerequisites(
  eligibilityHtml: string | null,
  courseCode: string,
  catalogue: ReadonlySet<string>,
): PrerequisiteReading {
  const text = plainText(eligibilityHtml);
  let registeredCounts = false;
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ])|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => {
      if (!REGISTERED.test(s)) return true;
      registeredCounts = true;
      // "Aktivt deltagande i DD1420 vars slutexamination ännu inte …" relaxes a requirement stated earlier.
      return false;
    });

  const groups: PrerequisiteGroup[] = [];
  for (const sentence of sentences) {
    for (const clause of sentence.split(/\bsamt\b/i)) {
      const codes = [
        ...new Set([
          ...(clause.match(CODE) ?? []),
          ...expandRanges(clause, catalogue),
        ]),
      ].filter((c) => c !== courseCode);
      if (!codes.length) continue;
      const known = codes.filter((c) => catalogue.has(c));
      groups.push({
        codes: known.length ? known : codes,
        strength: /aktivt deltagande/i.test(clause)
          ? "participating"
          : "completed",
        open: hasUncheckableRoute(clause),
        unresolvable: known.length === 0,
        text: sentence,
      });
    }
  }
  return { groups, registeredCounts, text };
}
