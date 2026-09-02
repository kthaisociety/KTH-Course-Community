import { describe, expect, it } from "vitest";
import { renderMagicLinkEmail } from "./render";

describe("renderMagicLinkEmail", () => {
  it("puts the sign-in URL on the button", () => {
    const url = "https://example.com/api/auth/magic-link/verify?token=abc";
    const { html } = renderMagicLinkEmail(url);

    expect(html).toContain(`href="${url}"`);
  });

  it("tells the recipient to ignore the mail if they did not request it", () => {
    const { html, subject } = renderMagicLinkEmail(
      "https://example.com/api/auth/magic-link/verify?token=abc",
    );

    expect(subject).toBe("Sign in to KTH Course Community");
    expect(html).toContain(
      "If you did not try to sign in, please disregard this message.",
    );
  });

  it("escapes a URL that contains HTML", () => {
    const { html } = renderMagicLinkEmail(
      'https://example.com/x?q="><script>alert(1)</script>',
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;");
  });
});
