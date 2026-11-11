import { describe, expect, it } from "vitest";
import { civingRequirements, requirementItems } from "./parse-eligibility";

// TSDSM's requirements, as its HT27 plan words them.
const TSDSM = `För antagning till programmet krävs uppfyllande av grundläggande behörighet, samt följande krav på särskild behörighet:
Engelska nivå 2 eller gymnasiekursen Engelska 6.
Tidigare utbildning måste innefatta minst 30 hp inom datateknik, datavetenskap, informationsteknik, elektroteknik eller tillämpad matematik.
Tidigare utbildning måste även innefatta grundläggande matematikkurser inom envariabelanalys, linjär algebra samt inom sannolikhetsteori och statistik.
Studenten måste ha tagit minst en kurs i programmering (helst Java, Python eller C) samt en kurs i algoritmer och datastrukturer.
Urval
Urvalet baseras på …
För civilingenjörsstudenter vid KTH med platsgaranti (mappning) på detta program motsvaras programmets särskilda behörighetskrav av nedanstående kurser inom respektive civilingenjörsprogram. Kurskoderna avser antagningsår 2024 på civilingenjörsprogrammet och kan variera för andra antagningsår.
Civilingenjörsutbildning i informationsteknik (CINTE)
Obligatoriska kurser:
SF1625 Envariabelanalys
ID1018 Programmering I eller ID1022 Konsten att programmera
Civilingenjörsutbildning i datateknik (CDATE)
Obligatoriska kurser:
DD1337 Programmering`;

describe("requirementItems", () => {
  const items = requirementItems(TSDSM);

  it("keeps one item per line, verbatim, and stops before selection", () => {
    expect(items.map((i) => i.kind)).toEqual([
      "english",
      "course",
      "course",
      "course",
    ]);
    expect(items[2].text).toMatch(/^Tidigare utbildning måste även innefatta/);
  });

  it("reads a credit pool's alternative subjects as one pool, not as areas", () => {
    expect(items[1].areas).toEqual([]);
    expect(items[1].totals).toEqual([
      { credits: 30, domains: ["Data/IT", "Elektroteknik", "Matematik"] },
    ]);
  });

  it("names the areas a line requires", () => {
    expect(items[2].areas).toEqual([
      "Envariabelanalys",
      "Linjär algebra",
      "Sannolikhetsteori och statistik",
    ]);
    expect(items[3].areas).toEqual([
      "Programmering",
      "Algoritmer och datastrukturer",
    ]);
  });
});

describe("civingRequirements", () => {
  const c = civingRequirements(TSDSM);

  it("reads KTH's course codes per civilingenjör programme, with the intake they refer to", () => {
    expect(c?.codesYear).toBe(2024);
    expect(c?.sections.CINTE).toEqual([
      {
        category: "Obligatoriska kurser",
        codes: ["SF1625"],
        text: "SF1625 Envariabelanalys",
      },
      {
        category: "Obligatoriska kurser",
        codes: ["ID1018", "ID1022"],
        text: "ID1018 Programmering I eller ID1022 Konsten att programmera",
      },
    ]);
    expect(c?.sections.CDATE).toHaveLength(1);
  });

  it("is null when the master's publishes no list", () => {
    expect(civingRequirements("Kandidatexamen inom datavetenskap.")).toBeNull();
  });
});
