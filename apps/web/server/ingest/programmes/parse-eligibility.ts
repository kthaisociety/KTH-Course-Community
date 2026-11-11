import type {
  CivingRequirement,
  KnowledgeArea,
  MasterEligibility,
  RequirementItem,
  RequirementKind,
} from "@/types/programme";

/**
 * A master's programme's entry requirements (särskild behörighet), one
 * checklist item per line of KTH's text.
 *
 * Each item keeps KTH's sentence verbatim. The areas, course codes and credit
 * totals read out of it only decide which of a student's courses look like
 * they cover it; the study plan never shows a parsed requirement without the
 * sentence it came from.
 */

/** Phrases that name an area in a requirement, and title fragments that cover it. */
const AREAS: { name: string; phrase: RegExp; titles: string[] }[] = [
  {
    name: "Envariabelanalys",
    phrase:
      /envariabel|analys i en variabel|analys i en och flera|single.variable calculus|calculus in one/i,
    titles: ["envariabelanalys", "analys i en variabel", "matematisk analys"],
  },
  {
    name: "Flervariabelanalys",
    phrase:
      /flervariabel|analys i (en och )?flera|multivariable|several variables/i,
    titles: ["flervariabelanalys", "flervariabel"],
  },
  {
    name: "Linjär algebra",
    phrase: /linjär algebra|linear algebra/i,
    titles: ["linjär algebra", "algebra och geometri"],
  },
  {
    name: "Sannolikhetsteori och statistik",
    phrase: /sannolikhet|statistik|probability|statistics/i,
    titles: ["sannolikhet", "statistik"],
  },
  {
    name: "Diskret matematik",
    phrase: /diskret matematik|discrete math/i,
    titles: ["diskret matematik"],
  },
  {
    name: "Differentialekvationer",
    phrase: /differentialekvation|differential equation/i,
    titles: ["differentialekvation"],
  },
  {
    name: "Numeriska metoder",
    phrase: /numerisk|numerical/i,
    titles: ["numerisk", "numeriska metoder"],
  },
  {
    name: "Programmering",
    phrase: /programmering|programming/i,
    titles: [
      "programmering",
      "programmeringsteknik",
      "programutveckling",
      "konsten att programmera",
    ],
  },
  {
    name: "Objektorienterad programmering",
    phrase: /objektorienterad|object.oriented/i,
    titles: ["objektorienterad", "programmering"],
  },
  {
    name: "Algoritmer och datastrukturer",
    phrase:
      /algoritmer och datastrukturer|algorithms and data structures|\bdatalogi\b/i,
    titles: [
      "algoritmer och datastrukturer",
      "datastrukturer",
      "tillämpad datalogi",
      "grundläggande datalogi",
    ],
  },
  {
    name: "Algoritmisk komplexitet",
    phrase: /komplexitet|complexity/i,
    titles: ["komplexitet"],
  },
  {
    name: "Signaler och system",
    phrase: /signaler och system|signals and systems/i,
    titles: [
      "signaler och system",
      "signalbehandling",
      "signalteori",
      "tidskontinuerliga signaler",
      "tidsdiskreta signaler",
    ],
  },
  {
    name: "Reglerteknik",
    phrase: /reglerteknik|control theory|automatic control/i,
    titles: ["reglerteknik"],
  },
  {
    name: "Elektroteknik",
    phrase: /elektriska kretsar|kretsteori|ellära|electrical circuit/i,
    titles: ["elektroteknik", "ellära", "kretsteori", "elektriska kretsar"],
  },
  {
    name: "Datorteknik",
    phrase: /datorteknik|datorarkitektur|computer organi/i,
    titles: ["datorteknik", "datorsystem", "datorarkitektur"],
  },
  { name: "Mekanik", phrase: /\bmekanik|mechanics/i, titles: ["mekanik"] },
  {
    name: "Hållfasthetslära",
    phrase: /hållfasthet|solid mechanics|strength of materials/i,
    titles: ["hållfasthetslära", "hållfasthet"],
  },
  {
    name: "Termodynamik",
    phrase: /termodynamik|thermodynamics/i,
    titles: ["termodynamik"],
  },
  {
    name: "Industriell ekonomi",
    phrase:
      /industriell ekonomi|industrial (economics|management)|företagsekonomi|redovisning/i,
    titles: ["industriell ekonomi", "ekonomi"],
  },
  {
    name: "Människa–datorinteraktion",
    phrase: /människa-datorinteraktion|\bMDI\b|human.computer/i,
    titles: ["människa-datorinteraktion", "interaktionsdesign"],
  },
];

export const KNOWLEDGE_AREAS: KnowledgeArea[] = AREAS.map(
  ({ name, titles }) => ({ name, titles }),
);

/** Subject domains a credit pool can name. */
const DOMAINS: [RegExp, string][] = [
  [/tillämpad matematik|matemati/i, "Matematik"],
  [
    /datateknik|datavetenskap|datalogi|informationsteknik|programmering|programvaru|computer science/i,
    "Data/IT",
  ],
  [/elektro|ellära|elektronik/i, "Elektroteknik"],
  [/fysik|physics/i, "Fysik"],
  [/\bkemi/i, "Kemi"],
  [/\bmekanik|maskinteknik|mechanical/i, "Maskin/Mekanik"],
];

const CODE = /\b[A-Z]{2}\d{3}[0-9X]\b/g;
const HP = /(\d{1,3}(?:,\d)?)\s*(?:hp|högskolepoäng|ECTS|credits)/gi;
const DROP =
  /^(för (antagning|att vara behörig|särskild behörighet|grundläggande behörighet|behörighet)|grundläggande behörighet:?$|särskild behörighet:?$|särskilda behörighetskrav:?$|läs mer|antalet platser|studenter som läser sista|vissa villkorligt valfria|se kth:s antagningsordning|särskilda behörighetsregler gäller|engelska b\/engelska 6 eller motsvarande$)/i;
const CIVING_HEAD =
  /För civilingenjörsstudenter vid KTH med\s+(platsgaranti|reserverad plats)/i;
const GENERAL_END =
  /(^|\n)\s*(Urval|Betyg från tidigare|Inom programmet kan|Inom programmets spår)/i;

const domainsIn = (s: string) =>
  DOMAINS.filter(([re]) => re.test(s)).map(([, d]) => d);
const codesIn = (s: string) => [...new Set(s.match(CODE) ?? [])];

function totalsIn(line: string): RequirementItem["totals"] {
  const out: RequirementItem["totals"] = [];
  const matches = [...line.matchAll(HP)];
  matches.forEach((m, i) => {
    const credits = Number(m[1].replace(",", "."));
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const nextStart = matches[i + 1]?.index ?? line.length;
    const after = line
      .slice(end, Math.min(nextStart, end + 160))
      .split(/[.;:]/)[0];
    if (credits >= 180 || /^\s*(vardera|each)/i.test(after)) return;
    const before = line.slice(0, start);
    // "en kurs i programmering om minst 6 hp" sizes one course; it is not a pool.
    if (
      /\b(kurs|course)\b[^.]{0,40}$/i.test(before) &&
      !/totalt|kurser/i.test(before)
    )
      return;
    let domains = domainsIn(after);
    if (!domains.length) {
      const sentence = before.split(".").at(-1) ?? "";
      let best: { at: number; name: string } | null = null;
      for (const [re, name] of DOMAINS)
        for (const hit of sentence.matchAll(new RegExp(re.source, "gi")))
          if (!best || (hit.index ?? 0) > best.at)
            best = { at: hit.index ?? 0, name };
      domains = best ? [best.name] : [];
    }
    if (domains.length)
      out.push({ credits, domains: [...new Set(domains)].sort() });
  });
  return out;
}

function areasIn(line: string): string[] {
  // "30 hp inom datateknik, elektroteknik eller matematik" lists alternative subjects, not required areas.
  const spans = [
    ...line.matchAll(
      /\d+(?:,\d)?\s*(?:hp|högskolepoäng|ECTS)\s+(?:studier\s+)?(?:inom|i|in)\s+[^.]*/gi,
    ),
  ].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length] as const);
  const inside = (i: number) => spans.some(([a, b]) => a <= i && i < b);
  const areas = AREAS.filter(({ phrase }) =>
    [...line.matchAll(new RegExp(phrase.source, "gi"))].some(
      (m) => !inside(m.index ?? 0),
    ),
  ).map((a) => a.name);
  if (areas.includes("Objektorienterad programmering"))
    return areas.filter((a) => a !== "Programmering");
  return areas;
}

function kindOf(
  line: string,
  areas: string[],
  codes: string[],
  totals: RequirementItem["totals"],
): RequirementKind {
  if (/rekommenderas|recommended/i.test(line)) return "recommended";
  if (
    /engelska|english/i.test(line) &&
    !areas.length &&
    !codes.length &&
    !totals.length
  )
    return "english";
  if (
    /kandidatexamen|högskoleingenjörsexamen|examen på grundnivå|examen från högskoleutbildning|180 (hp|högskolepoäng|ECTS)|bachelor/i.test(
      line,
    ) &&
    !codes.length &&
    !totals.length &&
    areas.length <= 1
  )
    return "degree";
  if (areas.length || codes.length || totals.length) return "course";
  return "note";
}

export function requirementItems(text: string): RequirementItem[] {
  const cuts = [text.search(GENERAL_END), text.search(CIVING_HEAD)].filter(
    (i) => i >= 0,
  );
  const general = (
    cuts.length ? text.slice(0, Math.min(...cuts)) : text
  ).replace(/ /g, " ");
  const lines = general
    .split(/\n|(?<=\.)\s+(?=Kunskaper i Engelska|Andra studier)/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const head = l.match(
        /^för (antagning|att vara behörig|särskild behörighet).*?(behörighet|krävs|detta):\s*(?=\S)/i,
      );
      return head ? l.slice(head[0].length).trim() : l;
    });
  const items: RequirementItem[] = [];
  let joinNext = false;
  for (const line of lines) {
    if (/^(eller|or)\.?$/i.test(line)) {
      joinNext = true;
      continue;
    }
    if (DROP.test(line) || /www\.|kth\.se|su\.se/.test(line)) continue;
    const codes = codesIn(line);
    const areas = codes.length ? [] : areasIn(line);
    const totals = totalsIn(line);
    const kind = kindOf(line, areas, codes, totals);
    const prev = items.at(-1);
    if (joinNext && prev?.kind === "course" && kind === "course") {
      prev.text += ` — eller — ${line}`;
      prev.codes = [...prev.codes, ...codes];
      prev.anyCode = true;
    } else {
      items.push({
        text: line,
        kind,
        areas: kind === "degree" ? [] : areas,
        codes,
        anyCode: codes.length > 1 && /alternativt|eller|\bor\b|\//i.test(line),
        totals,
      });
    }
    joinNext = false;
  }
  return items;
}

/**
 * One line of codes → what it asks for. A code joins the previous one as an
 * alternative when the text between them says so — "/", "eller", "alternativt"
 * — and starts a new requirement otherwise. "SF1920 Sannolikhetsteori och
 * statistik DD1310 Programmeringsteknik" is two required courses; "SF1626/SF1686
 * Flervariabelanalys" is one course under two codes.
 */
export function needsOf(line: string): string[][] {
  const needs: string[][] = [];
  let last = 0;
  for (const m of line.matchAll(CODE)) {
    const between = line.slice(last, m.index ?? 0);
    const alternative =
      needs.length > 0 && /\/|\beller\b|\balternativt\b|\bor\b/i.test(between);
    if (alternative) needs[needs.length - 1].push(m[0]);
    else needs.push([m[0]]);
    last = (m.index ?? 0) + m[0].length;
  }
  return needs.map((n) => [...new Set(n)]);
}

export function civingRequirements(text: string): MasterEligibility["civing"] {
  const at = text.search(CIVING_HEAD);
  if (at < 0) return null;
  const lines = text
    .slice(at)
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const basis = lines[0];
  const year = basis.match(/antagningsår (\d{4})/);
  const sections: Record<string, CivingRequirement[]> = {};
  let programmes: string[] | null = null;
  let category: string | null = null;
  for (const line of lines.slice(1)) {
    if (/^(Urval|Antalet platser)/.test(line)) break;
    const codes = codesIn(line);
    const named = [...line.matchAll(/\((C[A-Z]{4})\)/g)].map((m) => m[1]);
    if (named.length && !codes.length) {
      programmes = named;
      category = null;
      continue;
    }
    if (/^för alla/i.test(line)) {
      programmes = ["*"];
      category = null;
      continue;
    }
    if (!codes.length) {
      category = line.replace(/:$/, "");
      continue;
    }
    const text = line.replace(/^[-–]\s*/, "");
    const track = text.match(/^Spår\s+([^:]+?)\s*:/i)?.[1] ?? null;
    for (const p of programmes ?? ["*"]) {
      sections[p] = sections[p] ?? [];
      sections[p].push({
        category: category ?? "Krävs",
        codes,
        needs: needsOf(text),
        review: /\b(antingen|båda|både)\b/i.test(text),
        track,
        text,
      });
    }
  }
  return { basis, codesYear: year ? Number(year[1]) : null, sections };
}
