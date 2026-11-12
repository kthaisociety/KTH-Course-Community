/**
 * HTML → plain text for prose KTH publishes as HTML: syllabus eligibility,
 * programme plans. Domain-neutral, like `server/http/`, because the course
 * domain and the programme ingest both read the same kind of markup.
 *
 * Entities are decoded after tags are stripped, so an encoded `&lt;b&gt;`
 * in the prose stays text rather than becoming a tag that gets removed.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  aring: "å",
  auml: "ä",
  ouml: "ö",
  Aring: "Å",
  Auml: "Ä",
  Ouml: "Ö",
  eacute: "é",
  uuml: "ü",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const hex = name[1] === "x" || name[1] === "X";
      const n = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : whole;
    }
    return NAMED[name] ?? whole;
  });
}

/** One line per block (paragraph, list item, heading, table row), spaces collapsed. */
export function plainText(html: string | null | undefined): string {
  const stripped = (html ?? "")
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}
