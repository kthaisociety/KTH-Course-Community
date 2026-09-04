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
