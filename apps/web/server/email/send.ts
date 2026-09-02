import { renderMagicLinkEmail } from "./render";
import { getMailer, type Mailer } from "./ses";

export async function sendMagicLinkEmail(
  to: string,
  url: string,
  mailer?: Mailer,
): Promise<void> {
  if (!mailer && process.env.NODE_ENV !== "production") {
    console.info(`Magic link for ${to}:\n${url}`);
    return;
  }

  const rendered = renderMagicLinkEmail(url);
  await (mailer ?? getMailer()).send({ to, ...rendered });
}
