import xss from "xss";

export function sanitizeHtml(html: string): string {
  return xss(html, {
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style"],
  });
}

export function sanitizeCourseHtml(html: string | null | undefined): string {
  return sanitizeHtml(html?.trim() || "<p>—</p>");
}
