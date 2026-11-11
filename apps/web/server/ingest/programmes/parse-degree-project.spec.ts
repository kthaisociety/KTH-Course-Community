import { describe, expect, it } from "vitest";
import { degreeProjectGate } from "./parse-degree-project";

describe("degreeProjectGate", () => {
  it("reads a first-cycle project's bar (IA150X)", () => {
    const g = degreeProjectGate(
      "IA150X",
      "För att påbörja ett examensarbete krävs att kurser som anses relevanta för examensarbetet är godkända och att minst 120 högskolepoäng ur programmets utbildningsplan är slutförda.",
    );
    expect(g).toMatchObject({
      credits: 120,
      advancedCredits: null,
      needsMethods: false,
    });
  });

  it("reads a master's project's advanced bar and methods course (DA231X)", () => {
    const g = degreeProjectGate(
      "DA231X",
      "Godkända kurser på avancerad nivå om minst 60 hp, innefattande kurser som är relevanta för examensarbetet, inklusive en kurs i vetenskapsteori och forskningsmetodik. Ifall studenten är inskriven på ett civilingenjörsprogram ska samtliga kurser som krävs för utfärdande av kandidatexamen vara avklarade.",
    );
    expect(g).toMatchObject({
      credits: null,
      advancedCredits: 60,
      needsMethods: true,
      needsBachelorPart: true,
    });
  });

  it("reads a bar worded without 'minst' (ML100X)", () => {
    const g = degreeProjectGate(
      "ML100X",
      "135 högskolepoäng från slutförda obligatoriska kurser, inom dessa poäng ska dessa kurser vara slutförda ML1000 och ML1206",
    );
    expect(g).toMatchObject({ credits: 135, courses: ["ML1000", "ML1206"] });
  });

  it("does not take the project's own size for the bar", () => {
    expect(
      degreeProjectGate(
        "XX100X",
        "Examensarbetskurs om 15 hp. Minst 104 högskolepoäng från kurser i utbildningsplanen.",
      ).credits,
    ).toBe(104);
  });
});
