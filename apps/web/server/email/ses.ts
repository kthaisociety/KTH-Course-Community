import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { emailConfig } from "./config";

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type Mailer = {
  send(mail: Mail): Promise<void>;
};

function formatSender(displayName: string, address: string): string {
  if (address.includes("<")) return address;
  return `${displayName} <${address}>`;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function createSesMailer(client?: SESClient): Mailer {
  const ses = client ?? new SESClient({ region: requiredEnv("AWS_REGION") });
  const source = formatSender(emailConfig.appName, requiredEnv("SES_SENDER"));
  const replyTo = requiredEnv("SES_REPLY_TO");

  return {
    async send(mail) {
      await ses.send(
        new SendEmailCommand({
          Source: source,
          Destination: { ToAddresses: [mail.to] },
          ReplyToAddresses: [replyTo],
          Message: {
            Subject: { Charset: "UTF-8", Data: mail.subject },
            Body: {
              Html: { Charset: "UTF-8", Data: mail.html },
              Text: { Charset: "UTF-8", Data: mail.text },
            },
          },
        }),
        { abortSignal: AbortSignal.timeout(10_000) },
      );
    },
  };
}

let cached: Mailer | undefined;

export function getMailer(): Mailer {
  if (!cached) cached = createSesMailer();
  return cached;
}
