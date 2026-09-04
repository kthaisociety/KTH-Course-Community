/**
 * A review's message is stored as the rich-text editor's HTML. The card's
 * excerpt is one plain line, so it has to come out of that markup before it can
 * be measured or cut.
 */

/** Longer than this and the excerpt is cut. From the Review Card artboard. */
const EXCERPT_MAX_CHARS = 160;
/** Where the cut lands, leaving room for the ellipsis. Also the artboard's. */
const EXCERPT_CUT_CHARS = 157;

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * The readable text inside a message's markup, with runs of whitespace
 * collapsed. Deliberately a string transform rather than a DOM parse: it runs
 * on the server too, and it is only ever used for measuring and truncating —
 * anything actually rendered as markup goes through `sanitizeHtml`.
 */
export function toPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => NAMED_ENTITIES[entity] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The message as the wire wants it. An editor the writer never typed into
 * still emits markup — an empty paragraph, a stray `&nbsp;` — and storing that
 * would make a scores-only review look written. `reviews.message` is nullable
 * precisely so "wrote nothing" has an answer of its own.
 */
export function toStoredMessage(html: string): string | null {
  return toPlainText(html) ? html : null;
}

/**
 * The one line of the review the collapsed card shows. Cut mid-sentence rather
 * than mid-word, and never left with a dangling comma before the ellipsis —
 * the truncation rule is the artboard's own.
 */
export function toExcerpt(html: string | null | undefined): string {
  const text = toPlainText(html);
  if (text.length <= EXCERPT_MAX_CHARS) return text;
  return `${text.slice(0, EXCERPT_CUT_CHARS).replace(/[,;\s]+$/, "")}…`;
}
