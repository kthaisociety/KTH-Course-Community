import type { DegreeProjectGate } from "@/types/programme";

/**
 * A degree-project course's eligibility text → the credits that must be done
 * before it starts.
 *
 * The first "minst N hp" is the general bar; an "N hp på avancerad nivå" is the
 * master's bar; "N hp inom masterprogrammet" is a master's own bar. A few
 * syllabi only say "the programme's requirements"; those keep null credits
 * and the study plan shows their text instead of a number.
 */
const NUM = String.raw`(\d{2,3}(?:,\d)?)\s*(?:hp|högskolepoäng)`;
const num = (s: string) => Number(s.replace(",", "."));

export function degreeProjectGate(
  code: string,
  eligibility: string,
): DegreeProjectGate {
  const t = eligibility.replace(/examensarbetskurs om \d+ hp/gi, "");
  const adv =
    t.match(
      new RegExp(
        `(?:minst )?${NUM}\\s*(?:kurser )?(?:med fördjupning )?på avancerad nivå`,
        "i",
      ),
    ) ?? t.match(new RegExp(`avancerad nivå (?:om )?(?:minst )?${NUM}`, "i"));
  const master = t.match(
    new RegExp(`minst ${NUM} kurser inom masterprogrammet`, "i"),
  );
  const first =
    t.match(new RegExp(`minst ${NUM}`, "i")) ??
    t.match(
      new RegExp(
        `${NUM} (?:från|ur|inom|i|av) (?:slutförda |avklarade )?(?:kurser|obligatoriska|utbildningsplan|programmet|de obligatoriska|programmets)`,
        "i",
      ),
    ) ??
    t.match(new RegExp(`(?:slutförda|avklarade) kurser om ${NUM}`, "i"));
  let credits = first ? num(first[1]) : null;
  if (adv && credits === num(adv[1])) credits = null;
  if (master && credits === num(master[1])) credits = null;
  const when = t.match(
    /(senast[^.]{0,80}|två veckor efter[^.]{0,40}|tidigast[^.]{0,80})/,
  );
  return {
    code,
    credits,
    advancedCredits: adv ? num(adv[1]) : null,
    masterCredits: master ? num(master[1]) : null,
    needsBachelorPart: /kandidatexamen|årskurs 1\s*[-–]\s*3/.test(t),
    needsMethods: /vetenskapsteori|forskningsmetodik|vetenskapsmetodik/.test(t),
    courses: [...new Set(t.match(/\b[A-Z]{2}\d{3}[0-9A-Z]\b/g) ?? [])]
      .filter((c) => c !== code)
      .sort(),
    when: when ? when[1].trim() : null,
    text: eligibility.slice(0, 1400),
  };
}

/** The "Särskild behörighet" paragraph of a course page's text. */
export function specialEligibility(pageText: string): string {
  const i = pageText.indexOf("Särskild behörighet");
  if (i < 0) return "";
  return pageText
    .slice(i + "Särskild behörighet".length, i + 1400)
    .split(
      /Kurslitteratur|Examination och slutförande|Betygsskala|Literature/,
    )[0]
    .trim();
}
