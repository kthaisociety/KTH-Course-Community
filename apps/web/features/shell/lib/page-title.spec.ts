import { describe, expect, it } from "vitest";
import { pageTitleFor, WORDMARK } from "./page-title";

/**
 * Every route that *renders* inside `AppShell` — the whole of `app/(service)`
 * and `app/(public)` bar the redirects. `/` and `/auth` sit outside both groups
 * and get no shell, so no title.
 *
 * Add a route to either group and add it here: the shell titles its own header
 * from this map, and a route missing from it shows the wordmark instead of its
 * own name.
 */
const ROUTES_INSIDE_THE_SHELL = [
  "/search",
  "/saved",
  "/taken",
  "/collections",
  "/profile",
  "/about",
  "/contact",
];

describe("pageTitleFor", () => {
  // The Mobile Preview's own map, line 414, against this app's routes.
  it.each([
    ["/search", "Explore courses"],
    ["/saved", "Saved courses"],
    ["/profile", "My Page"],
    ["/taken", "Taken courses"],
  ])("names %s the way the design names it", (pathname, title) => {
    expect(pageTitleFor(pathname)).toBe(title);
  });

  it("names the pages the design does not key after their own heading", () => {
    expect(pageTitleFor("/about")).toBe("About");
    expect(pageTitleFor("/contact")).toBe("Contact");
    expect(pageTitleFor("/collections")).toBe("Collections");
  });

  /**
   * #68 §5 deleted these. `/course/<code>` and `/course` redirect and never
   * paint inside the shell; `/reviews`, `/newsletter` and `/editor-00` are gone
   * altogether. Titling any of them would outlive the page it named.
   */
  it.each(["/course", "/course/DD2380", "/reviews", "/newsletter"])(
    "has no title for the retired route %s",
    (pathname) => {
      expect(pageTitleFor(pathname)).toBe(WORDMARK);
    },
  );

  it.each(ROUTES_INSIDE_THE_SHELL)(
    "leaves no route in the shell falling back to the wordmark: %s",
    (pathname) => {
      expect(pageTitleFor(pathname)).not.toBe(WORDMARK);
    },
  );

  it("keeps a nested route under its section's title", () => {
    expect(pageTitleFor("/profile/settings")).toBe("My Page");
    expect(pageTitleFor("/collections/anything")).toBe("Collections");
  });

  it("prefers the longest matching prefix", () => {
    expect(pageTitleFor("/search/anything/deeper")).toBe("Explore courses");
  });

  it("falls back to the wordmark, which is what the design titles /", () => {
    expect(pageTitleFor("/")).toBe(WORDMARK);
    expect(pageTitleFor("")).toBe(WORDMARK);
    expect(pageTitleFor("/nothing-here")).toBe(WORDMARK);
  });

  // A route whose name merely starts with a keyed one is a different route.
  it("does not match a route that only shares a prefix's characters", () => {
    expect(pageTitleFor("/aboutus")).toBe(WORDMARK);
    expect(pageTitleFor("/savedcourses")).toBe(WORDMARK);
  });
});
