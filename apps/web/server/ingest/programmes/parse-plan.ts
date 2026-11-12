import type { CourseLevel, PlanCategory, PlanRow } from "@/types/programme";
import { plainText } from "../../text/html";

const CATEGORY: Record<string, PlanCategory> = {
  "obligatoriska kurser": "O",
  "villkorligt valfria kurser": "VV",
  "rekommenderade kurser": "R",
  "valfria kurser": "V",
};

export const COMMON_TRACK = "Gemensamma kurser";

/**
 * One year's course list (kurslistaarN) → rows. The list is HTML: an h3 per
 * track, an h4 per category, then a table of code / name / credits / level.
 */
export function parseCourseList(html: string | null | undefined): PlanRow[] {
  const rows: PlanRow[] = [];
  let track: string | null = null;
  let category: PlanCategory = "?";
  const re =
    /<h3[^>]*>([\s\S]*?)<\/h3>|<h4[^>]*>([\s\S]*?)<\/h4>|<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const m of (html ?? "").matchAll(re)) {
    const [, h3, h4, tr] = m;
    if (h3 !== undefined) {
      const name = plainText(h3);
      track = name === COMMON_TRACK ? null : name;
      category = "?";
    } else if (h4 !== undefined) {
      category = CATEGORY[plainText(h4).toLowerCase()] ?? "?";
    } else if (tr !== undefined && /<td/i.test(tr)) {
      const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (x) => x[1],
      );
      if (tds.length < 3) continue;
      const code = plainText(tds[0]);
      if (!/^[A-Z0-9]{5,7}$/.test(code)) continue;
      const nameHtml = tds[1];
      const name = plainText(nameHtml.replace(/<br[\s\S]*$/i, ""));
      const note = plainText(
        [...nameHtml.matchAll(/<em>([\s\S]*?)<\/em>/gi)]
          .map((x) => x[1])
          .join(" "),
      );
      const credits = plainText(tds[2]).match(/([\d.,]+)\s*(hp|fup)/);
      const levelText = tds[3] ? plainText(tds[3]).toLowerCase() : "";
      const level: CourseLevel = levelText.startsWith("avancerad")
        ? "A"
        : levelText.includes("förberedande")
          ? "P"
          : "B";
      rows.push({
        code,
        name,
        credits: credits ? Number(credits[1].replace(",", ".")) : null,
        level,
        category,
        track,
        note,
      });
    }
  }
  return rows;
}

/** "Endast en av …" sets named in the plan's course remarks. */
export function overlapsOf(rows: PlanRow[]): string[][] {
  const sets = new Map<string, string[]>();
  for (const row of rows) {
    if (!/endast en av|bara en av|only one of/i.test(row.note)) continue;
    const codes = [
      ...new Set([
        row.code,
        ...(row.note.match(/\b[A-Z]{2}\d{3}[0-9A-Z]\b/g) ?? []),
      ]),
    ].sort();
    if (codes.length > 1) sets.set(codes.join(","), codes);
  }
  return [...sets.values()];
}

export interface MasterMapping {
  mapped: string[];
  individual: string[];
  open: string[];
}

/**
 * Which master's programmes a civilingenjör plan maps, read from its prose.
 *
 * Plans name them as "Datalogi (TCSCM)" lines, sometimes without the code.
 * `names` maps a master's Swedish name to its code, for the lines that have
 * none. A paragraph saying the subject requirement may need an individual
 * study plan marks the masters listed after it; "ingen platsgaranti" marks a
 * line as open competition rather than mapped.
 */
export function mastersOf(
  prose: string,
  names: Map<string, string>,
): MasterMapping {
  const mapped = new Set<string>();
  const individual = new Set<string>();
  const open = new Set<string>();
  let inIndividual = false;
  for (const raw of prose.split("\n")) {
    const line = raw.trim().replace(/^[-•–]\s*/, "");
    if (/individuell studieplan/i.test(line)) inIndividual = true;
    if (/leder de obligatoriska och villkorligt valfria/i.test(line))
      inIndividual = false;
    const codes = new Set(
      line.match(/\((T[A-Z]{3}M)\)/g)?.map((c) => c.slice(1, -1)),
    );
    if (!codes.size) {
      const bare = line.replace(/[.,;:]+$/, "").toLowerCase();
      const code = names.get(bare);
      if (code) codes.add(code);
    }
    if (!codes.size) continue;
    const isOpen = /ingen platsgaranti|utan platsgaranti/i.test(line);
    for (const code of codes) {
      if (isOpen) open.add(code);
      else {
        mapped.add(code);
        if (inIndividual) individual.add(code);
      }
    }
  }
  for (const code of mapped) open.delete(code);
  return {
    mapped: [...mapped].sort(),
    individual: [...individual].sort(),
    open: [...open].sort(),
  };
}
