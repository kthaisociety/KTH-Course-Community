/**
 * What the mobile header calls the page you are on.
 *
 * The Mobile Preview derives this from the route, not from anything the page
 * hands upward — `Course Community - Mobile Preview.dc.html` line 414 is one
 * map keyed by page:
 *
 *   pageTitle: { landing: "Course Community", explore: "Explore courses",
 *                saved: "Saved courses", "my-page": "My Page",
 *                taken: "Taken courses" }[s.page]
 *
 * So this is that map against this app's routes, in the design's own words
 * where it has them. Deriving it here rather than registering it from each
 * page is what keeps the title correct on the first paint: a page that pushed
 * its title up through a client effect would render the wrong one for a frame,
 * and no page renders `PageHeader` yet anyway.
 */

/**
 * The design's `landing` title, and the fallback.
 *
 * **Every route that renders inside the shell is titled below**, so in practice
 * this only fires for a path that does not resolve to a page at all. A new
 * route belongs in `TITLES` — `page-title.spec.ts` holds the list and will fail
 * if one is added without a title.
 */
export const WORDMARK = "Course Community";

/**
 * Longest prefix wins, so `/course/DD2380` and `/profile/settings` inherit
 * their section's title.
 */
const TITLES: ReadonlyArray<readonly [string, string]> = [
  // The design's own five, less `taken`, whose route #92 still has to build.
  ["/search", "Explore courses"],
  ["/saved", "Saved courses"],
  ["/profile", "My Page"],
  // Routes the design does not key, titled after the page's own heading.
  ["/collections", "Collections"],
  // #96 owns About and Contact if it wants different words.
  ["/newsletter", "Newsletter"],
  ["/contact", "Contact"],
  ["/reviews", "Reviews"],
  ["/course", "Courses"],
  ["/about", "About"],
];

export function pageTitleFor(pathname: string): string {
  const match = TITLES.filter(
    ([href]) => pathname === href || pathname.startsWith(`${href}/`),
  ).sort((a, b) => b[0].length - a[0].length)[0];

  return match ? match[1] : WORDMARK;
}
