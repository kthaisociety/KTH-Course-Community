import { describe, expect, it } from "vitest";
import { trackLabel } from "./tracks";

describe("trackLabel", () => {
  const names = {
    "Inriktning: Matematik och fysik (MAFY)":
      "Specialisations: Mathematics and Physics (MAFY)",
  };

  it("shows KTH's English name without the prefix the field's label already says", () => {
    expect(trackLabel("Inriktning: Matematik och fysik (MAFY)", names)).toBe(
      "Mathematics and Physics (MAFY)",
    );
  });

  it("falls back to the Swedish heading, still without its prefix", () => {
    expect(trackLabel("Inriktning: Datateknik (TIDA)", names)).toBe(
      "Datateknik (TIDA)",
    );
  });
});
