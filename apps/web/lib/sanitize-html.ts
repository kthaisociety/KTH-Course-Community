import DOMPurify from "isomorphic-dompurify";

export function sanitizeCourseHtml(html: string | null | undefined): string {
  const normalized = html?.trim() || "<p>—</p>";
  return DOMPurify.sanitize(normalized);
}
