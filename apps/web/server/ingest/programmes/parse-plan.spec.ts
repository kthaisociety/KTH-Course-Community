import { describe, expect, it } from "vitest";
import { mastersOf, overlapsOf, parseCourseList } from "./parse-plan";

const LIST = `<h3>Gemensamma kurser</h3>
<h4>Obligatoriska kurser</h4>
<table><tbody>
<tr><td>ID1018</td><td>Programmering I</td><td>7.5 hp</td><td>Grundnivå</td></tr>
</tbody></table>
<h4>Villkorligt valfria kurser</h4>
<table><tbody>
<tr><td>DD2350</td><td>Algoritmer, datastrukturer och komplexitet<br><em>Endast en av DD2350, DD2352 får ingå i examen.</em></td><td>9.5 hp</td><td>Avancerad nivå</td></tr>
<tr><td>DD2352</td><td>Algoritmer och komplexitet</td><td>7,5 hp</td><td>Avancerad nivå</td></tr>
</tbody></table>
<h3>Inriktning X</h3>
<h4>Obligatoriska kurser</h4>
<table><tbody><tr><td>SF1626</td><td>Flervariabelanalys</td><td>7.5 hp</td><td>Grundnivå</td></tr></tbody></table>`;

describe("parseCourseList", () => {
  const rows = parseCourseList(LIST);

  it("reads code, name, credits, level, category and track", () => {
    expect(rows[0]).toEqual({
      code: "ID1018",
      name: "Programmering I",
      credits: 7.5,
      level: "B",
      category: "O",
      track: null,
      note: "",
    });
    expect(rows[1]).toMatchObject({
      code: "DD2350",
      category: "VV",
      level: "A",
      credits: 9.5,
    });
    expect(rows[3]).toMatchObject({
      code: "SF1626",
      track: "Inriktning X",
      category: "O",
    });
  });

  it("finds the plan's 'only one of' sets", () => {
    expect(overlapsOf(rows)).toEqual([["DD2350", "DD2352"]]);
  });
});

describe("mastersOf", () => {
  const names = new Map([
    ["datalogi", "TCSCM"],
    ["maskininlärning", "TMAIM"],
  ]);

  it("reads codes, bare names, and the individual-study-plan group", () => {
    const prose = [
      "På följande mappade masterprogram leder de obligatoriska och villkorligt valfria kurserna till …:",
      "Datalogi (TCSCM)",
      "På följande … i en så kallad individuell studieplanering.",
      "Maskininlärning",
      "Medicinsk teknik (TMLEM) – ingen platsgaranti",
    ].join("\n");
    expect(mastersOf(prose, names)).toEqual({
      mapped: ["TCSCM", "TMAIM"],
      individual: ["TMAIM"],
      open: ["TMLEM"],
    });
  });
});
