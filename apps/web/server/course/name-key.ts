/**
 * The loose form a course name is looked up by in the catalogue: NFKC-folded,
 * ASCII-lower-cased, split into runs of ASCII letters and digits, the
 * connectives `and` and `och` dropped as whole words, and the rest joined.
 * `&` disappears with the other separators, so `&`, `and` and `och` all read
 * the same.
 *
 * It is the JavaScript half of a pair, and must stay identical to the SQL half,
 * `nameKeySql` in `./repository.ts`, which computes the same key from a
 * catalogue column. Each step was chosen because it gives the same answer in
 * both languages whatever the database's collation is: only ASCII capitals are
 * lower-cased — plus `İ`, the one capital whose lower case is an ASCII letter —
 * and non-ASCII letters are dropped rather than compared.
 *
 * The key is a prefilter, and it must never be narrower than the transcript
 * matcher's `normaliseCourseName`: two names that function treats as equal
 * always share a key. A separator of any kind — a non-breaking space, a dash,
 * a comma — counts for nothing, so a connective beside one cannot be missed.
 * The key is broader the other way round — "Linjär" and "Linjar" share one —
 * and every hit is re-checked by the matcher, whose normalisation is the
 * authority.
 */
export function courseNameKey(name: string): string {
  const words = name
    .normalize("NFKC")
    .replace(/[A-Zİ]/g, (capital) =>
      capital === "İ" ? "i" : capital.toLowerCase(),
    )
    .replace(/[^a-z0-9]+/g, " ");
  return ` ${words} `.replace(/ (?:and|och)(?= )/g, "").replace(/ /g, "");
}
