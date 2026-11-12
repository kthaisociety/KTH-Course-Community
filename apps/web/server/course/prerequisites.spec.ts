import { describe, expect, it } from "vitest";
import { readPrerequisites } from "./prerequisites";

const catalogue = new Set([
  "DD1337",
  "DD1310",
  "DD1311",
  "DD1318",
  "DD1380",
  "ID1018",
  "SF1624",
  "SF1625",
  "SF1912",
  "DD1338",
]);

describe("readPrerequisites", () => {
  it("makes one group per clause, met by any of its codes", () => {
    const r = readPrerequisites(
      "<p>Slutf&#246;rd kurs i programmeringsteknik motsvarande DD1337, DD1318 eller ID1018.</p>",
      "DH2642",
      catalogue,
    );
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toMatchObject({
      codes: ["DD1337", "DD1318", "ID1018"],
      strength: "completed",
      open: false,
      unresolvable: false,
    });
  });

  it("splits at samt into separate requirements", () => {
    const r = readPrerequisites(
      "<p>Kunskaper i linjär algebra motsvarande SF1624 samt sannolikhetslära motsvarande SF1912.</p>",
      "X",
      catalogue,
    );
    expect(r.groups.map((g) => g.codes)).toEqual([["SF1624"], ["SF1912"]]);
  });

  it("expands code ranges against the catalogue", () => {
    const r = readPrerequisites(
      "<p>Motsvarande slutförd kurs DD1310-DD1318/DD1337.</p>",
      "X",
      catalogue,
    );
    expect(r.groups[0].codes.sort()).toEqual([
      "DD1310",
      "DD1311",
      "DD1318",
      "DD1337",
    ]);
  });

  it("records Ladok's sentence instead of reading it as a requirement", () => {
    const r = readPrerequisites(
      "<p>Kunskaper motsvarande DD1337.</p><p>Aktivt deltagande i kursomgång vars slutexamination ännu inte är Ladokrapporterad jämställs med slutförd kurs.</p>",
      "DD1338",
      catalogue,
    );
    expect(r.registeredCounts).toBe(true);
    expect(r.groups).toHaveLength(1);
  });

  it("marks a group open when a route names no course", () => {
    const r = readPrerequisites(
      "<p>Kunskaper motsvarande DD1337 eller 12 hp självständig programvaruutveckling.</p>",
      "X",
      catalogue,
    );
    expect(r.groups[0].open).toBe(true);
  });

  it("marks a group unresolvable when no code is in the catalogue", () => {
    const r = readPrerequisites("<p>Motsvarande ZZ9999.</p>", "X", catalogue);
    expect(r.groups[0].unresolvable).toBe(true);
  });
});
