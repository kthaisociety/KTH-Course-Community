import type { CurrentRound } from "@/types/programme";

/**
 * A kth.se course page → its rounds for the running academic year.
 *
 * The page embeds its data as `window.__compressedData__DATA`, URL-encoded
 * JSON with `courseData.roundsBySemester`. Each round prints its periods as
 * "VT 2027: P4 (7.5 hp), P3 (7.5 hp)". This is the only public source that
 * lists every round of a course this year: the catalogue holds 2025/26, and a
 * programme's year page lists only that programme's round. IA150X shows why it
 * matters: CINTE takes it P3–P4 at 50 %, and it also runs in P4 alone at 100 %.
 */
export function parseCourseRounds(html: string): CurrentRound[] {
  const m = html.match(/__compressedData__DATA\s*=\s*"([\s\S]*?)"/);
  if (!m) return [];
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(m[1]));
  } catch {
    return [];
  }
  const bySemester =
    (data as { courseData?: { roundsBySemester?: Record<string, unknown[]> } })
      ?.courseData?.roundsBySemester ?? {};
  const out: CurrentRound[] = [];
  for (const [term, rounds] of Object.entries(bySemester)) {
    for (const raw of rounds ?? []) {
      const r = raw as Record<string, unknown>;
      if (r.round_is_cancelled === true) continue;
      const credits = [0, 0, 0, 0, 0, 0];
      for (const p of String(r.round_periods ?? "").matchAll(
        /P([0-5])\s*\((\d+(?:[.,]\d+)?)\s*hp\)/g,
      ))
        credits[Number(p[1])] += Number(p[2].replace(",", "."));
      if (!credits.some((c) => c > 0)) continue;
      const programmes = [
        ...new Set(
          [
            ...String(r.round_part_of_programme ?? "").matchAll(
              /\/program\/([A-ZÅÄÖ0-9]+)\//g,
            ),
          ].map((x) => x[1]),
        ),
      ].sort();
      const pace =
        typeof r.round_study_pace === "number" ? r.round_study_pace : null;
      const key = `${term}:${credits.join()}:${pace}`;
      const same = out.find(
        (o) => `${o.term}:${o.credits.join()}:${o.pace}` === key,
      );
      if (same)
        same.programmes = [
          ...new Set([...same.programmes, ...programmes]),
        ].sort();
      else out.push({ term, credits, pace, programmes });
    }
  }
  return out;
}
