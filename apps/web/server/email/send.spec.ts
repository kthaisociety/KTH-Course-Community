import { describe, expect, it } from "vitest";
import { sendMagicLinkEmail } from "./send";
import type { Mail } from "./ses";

describe("sendMagicLinkEmail", () => {
  it("sends the rendered magic-link mail to the recipient", async () => {
    const sent: Mail[] = [];
    const url = "https://example.com/api/auth/magic-link/verify?token=abc";

    await sendMagicLinkEmail("student@kth.se", url, {
      send: async (mail) => {
        sent.push(mail);
      },
    });

    expect(sent).toEqual([
      expect.objectContaining({
        to: "student@kth.se",
        subject: "Sign in to KTH Course Community",
        html: expect.stringContaining(`href="${url}"`),
        text: expect.stringContaining(url),
      }),
    ]);
  });
});
