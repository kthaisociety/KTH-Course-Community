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

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

/**
 * A write-up typed into a plain `<textarea>` as the markup `reviews.message`
 * holds.
 *
 * `message` has exactly one renderer — `parse(sanitizeHtml(...))` on the review
 * card — and `sanitizeHtml` is configured with `stripIgnoreTag`, so anything
 * tag-shaped in a raw plain string is deleted on the way to the screen. A
 * reviewer who writes "use `<vector>` from STL" would watch the useful half of
 * their sentence disappear. Escaping first means the column holds one format,
 * whichever form typed into it, and the reviewer gets back the characters they
 * typed.
 *
 * Blank lines become paragraphs and single newlines become breaks, which is the
 * only structure a textarea can express. Text with nothing in it stays `""`;
 * turning that into `<p></p>` would make a review with no write-up look
 * written, and `toStoredMessage` is what decides that question.
 */
export function fromPlainText(text: string): string {
  const escaped = text.replace(/[&<>]/g, (char) => ESCAPES[char]);
  return escaped
    .split(/\n[^\S\n]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/**
 * The tags that end a line of text. Everything else is inline, and inline tags
 * sit *inside* a word as often as around one.
 */
const BLOCK_TAGS =
  "p|div|br|li|ul|ol|h[1-6]|blockquote|pre|hr|section|article|figure|tr|table";

const BLOCK_TAG_RE = new RegExp(`<\\s*/?\\s*(?:${BLOCK_TAGS})\\b[^>]*>`, "gi");

/**
 * A stored message back in the `<textarea>` it will be edited in — the inverse
 * of {@link fromPlainText}, and the reason it is not {@link toPlainText}.
 *
 * `toPlainText` puts a space where every tag was, which is right for measuring
 * and cutting an excerpt and wrong for anything that will be *written back*.
 * `<strong>foo</strong><em>bar</em>` renders as "foobar", and a reviewer who
 * opened that review to fix a score would have saved "foo bar" — a word split
 * in half by an edit they did not make. Inline tags are therefore removed
 * without leaving anything behind, and only the tags that genuinely end a line
 * become one.
 *
 * Paragraphs come back as blank lines and `<br />` as single newlines, which is
 * exactly what `fromPlainText` reads: a message that came from a textarea makes
 * the round trip unchanged, and `review-text.spec.ts` asserts that in both
 * directions. A list or a heading — which only the retired rich-text dialog
 * could produce — comes back as paragraphs, because paragraphs and line breaks
 * are the whole of what a textarea can express.
 */
export function toEditableText(html: string | null | undefined): string {
  if (!html) return "";
  return (
    html
      .replace(BLOCK_TAG_RE, "\n")
      // Every remaining tag is inline, and leaves nothing in its place.
      .replace(/<[^>]*>/g, "")
      .replace(/&[a-z]+;|&#\d+;/gi, (entity) => NAMED_ENTITIES[entity] ?? " ")
      // Spaces and tabs collapse; newlines are structure and do not.
      .replace(/[^\S\n]+/g, " ")
      .replace(/[^\S\n]*\n[^\S\n]*/g, "\n")
      // Three or more line ends still mean one paragraph break.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
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
