import { describe, expect, it } from "vitest";
import { displayNameOf, initialsOf } from "./identity";

describe("displayNameOf", () => {
  it("prefers the name", () => {
    expect(displayNameOf("Elsa Lindqvist", "elsa@kth.se")).toBe(
      "Elsa Lindqvist",
    );
  });

  // A magic-link account has an email and nothing else until the reader sets a
  // name, which is the common case this has to stay sensible for.
  it("falls back to the email's local part when there is no name", () => {
    expect(displayNameOf("", "harriet@kth.se")).toBe("harriet");
  });

  it("falls back to the email when the name is only whitespace", () => {
    expect(displayNameOf("   ", "harriet@kth.se")).toBe("harriet");
  });

  it("trims the name a paste carried in", () => {
    expect(displayNameOf("  Elsa Lindqvist  ", "elsa@kth.se")).toBe(
      "Elsa Lindqvist",
    );
  });

  it("has nothing to show with neither", () => {
    expect(displayNameOf("", "")).toBe("");
  });
});

describe("initialsOf", () => {
  it("takes the first letter of each name part", () => {
    expect(initialsOf("Elsa Lindqvist", "elsa@kth.se")).toBe("EL");
  });

  it("stops at two letters", () => {
    expect(initialsOf("Anna Maria Sofia Berg", "anna@kth.se")).toBe("AM");
  });

  it("ignores the runs of whitespace a pasted name carries", () => {
    expect(initialsOf("  Elsa   Lindqvist  ", "elsa@kth.se")).toBe("EL");
  });

  it("falls back to the email when there is no name", () => {
    expect(initialsOf("", "harriet@kth.se")).toBe("H");
  });

  it("falls back to the email when the name is only whitespace", () => {
    expect(initialsOf("   ", "harriet@kth.se")).toBe("H");
  });

  it("has a mark to draw even with neither", () => {
    expect(initialsOf("", "")).toBe("?");
  });
});

// The pair is shared so a circle can never disagree with the name beside it.
describe("the two together", () => {
  it("read the same fields in the same order", () => {
    expect(displayNameOf("", "nils@kth.se")).toBe("nils");
    expect(initialsOf("", "nils@kth.se")).toBe("N");
  });
});
