/**
 * What the Collections page counts, offers and orders — everything it decides
 * without rendering anything, so it is tested in the `logic` project rather than
 * through a render.
 *
 * The artboard's tile also carries a "last updated" line, sourced from an
 * `updated` string on its mock store. `collections` has `created_at` and no
 * `updated_at`, and nothing writes one, so there is no such label here: a
 * relative time with nothing behind it is worse than the missing line (#68).
 */

/** `"1 course"` / `"3 courses"`, as the artboard writes the tile's count. */
export function courseCountLabel(count: number): string {
  return `${count} ${count === 1 ? "course" : "courses"}`;
}

/** How many course lines a tile shows before it counts the rest instead. */
export const TILE_PREVIEW_LIMIT = 3;

/** `"+2 more"`, or `null` when the tile already lists every course. */
export function overflowLabel(count: number): string | null {
  const hidden = count - TILE_PREVIEW_LIMIT;
  return hidden > 0 ? `+${hidden} more` : null;
}

/**
 * The saved courses a collection can still take.
 *
 * A course may only join a collection its owner has also saved — composite
 * foreign keys enforce it, and `addCourseToCollection` refuses before they have
 * to. So the picker is built *from* the saved codes rather than filtered for
 * them afterwards: there is no path here that offers an unsaved course and
 * lets the server say no.
 */
export function addableCourseCodes(
  savedCourseCodes: readonly string[],
  collectionCourseCodes: readonly string[],
): string[] {
  const held = new Set(collectionCourseCodes);
  return savedCourseCodes.filter((courseCode) => !held.has(courseCode));
}

/**
 * The collection's order with one course moved one place towards `direction`.
 *
 * `collection_courses.position` is the only ordering the schema carries, and
 * `collections.reorder` rewrites it wholesale, so a move is computed here and
 * sent as the whole new order.
 *
 * A move that would leave the list returns the order unchanged, so a caller can
 * compare against what it passed in to decide whether there is anything to send.
 */
export function moveCourse(
  courseCodes: readonly string[],
  courseCode: string,
  direction: "up" | "down",
): string[] {
  const from = courseCodes.indexOf(courseCode);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= courseCodes.length) return [...courseCodes];

  const moved = [...courseCodes];
  moved[from] = courseCodes[to] as string;
  moved[to] = courseCode;
  return moved;
}
