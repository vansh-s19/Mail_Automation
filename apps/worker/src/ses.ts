import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import MailComposer from "nodemailer/lib/mail-composer";
import { env, requireSesConfig } from "@mail-automation/config";

let client: SESv2Client | null = null;

function getClient(): SESv2Client {
  if (!client) {
    client = new SESv2Client({
      region: requireSesConfig().AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

/** Error codes SES returns for addresses/content that will never succeed - retrying wastes the attempt budget. */
const PERMANENT_SES_ERROR_NAMES = new Set([
  "MessageRejected",
  "MailFromDomainNotVerifiedException",
  "AccountSuspendedException",
]);

export function isPermanentSesError(err: unknown): boolean {
  const name = (err as { name?: string } | undefined)?.name;
  return !!name && PERMANENT_SES_ERROR_NAMES.has(name);
}

export interface SesAttachment {
  filename: string;
  content: Buffer;
}

export async function sendViaSes(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment?: SesAttachment;
}): Promise<{ messageId: string }> {
  const config = requireSesConfig();

  // SESv2's Content.Simple (the no-attachment path) can't carry attachments -
  // only Content.Raw (a full MIME message) can. Only pay the MIME-building
  // cost when a step actually has a PDF attached.
  const content = params.attachment
    ? { Raw: { Data: await buildRawMimeMessage(params) } }
    : {
        Simple: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: params.html, Charset: "UTF-8" },
            Text: { Data: params.text, Charset: "UTF-8" },
          },
        },
      };

  const command = new SendEmailCommand({
    FromEmailAddress: config.SES_FROM_ADDRESS,
    Destination: { ToAddresses: [params.to] },
    Content: content,
    ConfigurationSetName: env.SES_CONFIGURATION_SET,
  });

  const response = await getClient().send(command);
  if (!response.MessageId) {
    throw new Error("SES accepted the send but returned no MessageId");
  }
  return { messageId: response.MessageId };
}

async function buildRawMimeMessage(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment?: SesAttachment;
}): Promise<Buffer> {
  const config = requireSesConfig();
  const composer = new MailComposer({
    from: config.SES_FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachment
      ? [{ filename: params.attachment.filename, content: params.attachment.content, contentType: "application/pdf" }]
      : [],
  });

  return new Promise((resolve, reject) => {
    composer.compile().build((err, message) => {
      if (err) reject(err);
      else resolve(message);
    });
  });
}
