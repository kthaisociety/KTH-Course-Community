import { describe, expect, it } from "vitest";
import { authHref, DEFAULT_RETURN_TO, safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps a same-site path with its query", () => {
    expect(safeReturnTo("/search?q=graphs&open=DD2380&kind=review")).toBe(
      "/search?q=graphs&open=DD2380&kind=review",
    );
  });

  it("falls back when nothing was asked for", () => {
    expect(safeReturnTo(null)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo(undefined)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo("")).toBe(DEFAULT_RETURN_TO);
  });

  /*
   * The open redirect, in every spelling that has ever been used for one.
   *
   * `?next=` is as easy to write as it is to read, so a sign-in that will
   * forward anywhere is a link on the real site that really signs the victim in
   * and then hands them to somebody else. A scheme-relative `//host` and a
   * `/\host` — which browsers normalise to the same thing — are the two that
   * look local enough to slip a "starts with a slash" check.
   */
  it.each([
    "https://evil.example/steal",
    "http://evil.example",
    "//evil.example/steal",
    String.raw`/\evil.example/steal`,
    "javascript:alert(1)",
    "search?q=graphs",
    "../search",
  ])("refuses %s", (candidate) => {
    expect(safeReturnTo(candidate)).toBe(DEFAULT_RETURN_TO);
  });

  it("refuses a path carrying a control character", () => {
    const newline = String.fromCharCode(10);
    const nul = String.fromCharCode(0);
    expect(safeReturnTo(`/search${newline}Set-Cookie: x`)).toBe(
      DEFAULT_RETURN_TO,
    );
    expect(safeReturnTo(`/search${nul}`)).toBe(DEFAULT_RETURN_TO);
  });

  // Signing in and landing back on the sign-in page, signed in.
  it("refuses to come back to the sign-in page", () => {
    expect(safeReturnTo("/auth")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo("/auth?next=%2Fsearch")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo("/auth/callback")).toBe(DEFAULT_RETURN_TO);
  });

  // `/authors` is not `/auth`, and prefix matching alone would say it is.
  it("does not mistake another route for the sign-in page", () => {
    expect(safeReturnTo("/authors")).toBe("/authors");
  });
});

describe("authHref", () => {
  it("carries the destination the email path cannot carry any other way", () => {
    expect(authHref("/search?q=graphs&open=DD2380&kind=review")).toBe(
      "/auth?next=%2Fsearch%3Fq%3Dgraphs%26open%3DDD2380%26kind%3Dreview",
    );
  });

  it("says nothing when there is nothing to say", () => {
    expect(authHref(DEFAULT_RETURN_TO)).toBe("/auth");
    expect(authHref("https://evil.example")).toBe("/auth");
  });
});
