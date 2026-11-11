import type { PeriodCredits } from "@/types/programme";

/**
 * A round's "P3 (4,5 hp), P4 (3,0 hp)" → credits per period, index 0..5 =
 * P0..P5. A period printed without credits shares what is left evenly.
 *
 * The catalogue truncates some rounds to their first term; the planner draws
 * the missing credits as continuing, so this returns exactly what is printed
 * and nothing more.
 */
export function periodCredits(
  formatted: string | null,
  courseCredits: number,
): PeriodCredits | null {
  if (!formatted) return null;
  const out = [0, 0, 0, 0, 0, 0];
  const bare: number[] = [];
  for (const m of formatted.matchAll(
    /P(\d)\s*(?:\((\d+(?:[.,]\d+)?)\s*hp\))?/g,
  )) {
    const p = Number(m[1]);
    if (p > 5) continue;
    if (m[2]) out[p] += Number(m[2].replace(",", "."));
    else bare.push(p);
  }
  if (bare.length) {
    const left = Math.max(0, courseCredits - out.reduce((a, b) => a + b, 0));
    for (const p of bare) out[p] += left / bare.length;
  }
  return out.some((x) => x > 0) ? out : null;
}
