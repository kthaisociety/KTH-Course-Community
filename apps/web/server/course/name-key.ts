/**
 * The loose form a course name is looked up by in the catalogue: lower-cased,
 * `&` and the Swedish `och` read as `and`, and everything but ASCII letters
 * and digits removed.
 *
 * It is the JavaScript half of a pair, and must stay identical to the SQL half,
 * `nameKeySql` in `./repository.ts`, which computes the same key from a
 * catalogue column. Each step was chosen because it gives the same answer in
 * both languages whatever the database's collation is: Postgres `lower()` may
 * leave a non-ASCII capital such as `Å` as it is, so non-ASCII letters are
 * dropped on both sides rather than compared. That makes the key broader than
 * the real comparison — "Linjär" and "Linjar" share a key — and it is only a
 * prefilter: every hit is re-checked by the transcript matcher, whose own
 * normalisation is the authority.
 */
export function courseNameKey(name: string): string {
  return name
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(" och ", " and ")
    .replace(/[^a-z0-9]+/g, "");
}
