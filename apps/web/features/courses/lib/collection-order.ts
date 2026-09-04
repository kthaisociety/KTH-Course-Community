/**
 * What `collections.reorder` does to a collection's order, in the browser.
 *
 * The procedure accepts a **prefix**: the codes it names come first, in the
 * order given, and every member left out keeps its relative order behind them.
 * `reorderCollectionCourses` in `server/collections/service.ts` is the
 * authority; this mirrors it so an optimistic cache update shows the order the
 * server is about to store rather than a guess at it.
 *
 * A code that is not a member is dropped rather than inserted. The server
 * rejects one outright, and the UI never sends one — it reorders codes it is
 * already rendering — so dropping it keeps the optimistic list equal to what
 * comes back on a request that succeeds, and harmless on the one that throws.
 *
 * ## Why this lives under `courses` and not `collections`
 *
 * It is used by exactly one caller, `useCollectionMutations`, which is here
 * because the course card's picker needs it. `features/collections` imports
 * `CourseCardItem` from `@/features/courses`, so moving this the other way
 * would put a cycle between the two feature barrels. The page's own move
 * gesture — `moveCourse` in `features/collections/lib/collection-model.ts` —
 * stays with the page for the same reason, in the direction that works.
 */
export function applyReorder(
  current: readonly string[],
  requested: readonly string[],
): string[] {
  const members = new Set(current);

  const named: string[] = [];
  const seen = new Set<string>();
  for (const courseCode of requested) {
    if (!members.has(courseCode) || seen.has(courseCode)) continue;
    seen.add(courseCode);
    named.push(courseCode);
  }

  return [...named, ...current.filter((code) => !seen.has(code))];
}
