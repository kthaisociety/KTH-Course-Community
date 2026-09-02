import { readFileSync } from "node:fs";
import path from "node:path";
import { emailConfig } from "./config";

const template = readFileSync(
  path.join(process.cwd(), "server", "email", "templates", "magic-link.html"),
  "utf8",
);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderMagicLinkEmail(url: string): {
  subject: string;
  html: string;
  text: string;
} {
  const values: Record<string, string> = {
    url: escapeHtml(url),
    appName: escapeHtml(emailConfig.appName),
    appDescription: escapeHtml(emailConfig.appDescription),
    logoUrl: escapeHtml(emailConfig.logoUrl),
    legalNoticeUrl: escapeHtml(emailConfig.legalNoticeUrl),
    termsAndConditionsUrl: escapeHtml(emailConfig.termsAndConditionsUrl),
    privacyAndCookiesUrl: escapeHtml(emailConfig.privacyAndCookiesUrl),
  };

  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return values[key] ?? "";
  });

  return {
    subject: `Sign in to ${emailConfig.appName}`,
    html,
    text: `Sign in to ${emailConfig.appName}: ${url}\n\nIf you did not try to sign in, please disregard this message.`,
  };
}
