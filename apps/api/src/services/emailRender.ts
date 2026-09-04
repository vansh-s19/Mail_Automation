import { renderMergeTags } from "@mail-automation/shared";
import { env } from "@mail-automation/config";
import { generateUnsubscribeToken } from "./unsubscribeToken";
import type { Contact, Template } from "@mail-automation/db";

/**
 * Renders a template for a specific contact - merge tags filled in, plus the
 * unsubscribe footer every outgoing email must carry. This is what the (not
 * yet built) SES worker will call before sending, and what the preview
 * endpoint uses so the client can see a real one before sending is live.
 */
export function renderEmailForContact(template: Template, contact: Contact): { subject: string; html: string; text: string } {
  const fields = {
    name: contact.name ?? "",
    title: contact.title ?? "",
    company: contact.company ?? "",
    location: contact.locationRaw ?? "",
  };

  const subject = renderMergeTags(template.subject, fields);
  const bodyHtml = renderMergeTags(template.bodyHtml, fields);
  const bodyText = renderMergeTags(template.bodyText ?? "", fields);

  const unsubscribeUrl = `${env.PUBLIC_API_URL}/unsubscribe?token=${generateUnsubscribeToken(contact.id)}`;

  const html = `${bodyHtml}<br/><br/><hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px"/><p style="font-size:12px;color:#94a3b8">Don't want future emails? <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a></p>`;
  const text = `${bodyText}\n\n---\nDon't want future emails? Unsubscribe: ${unsubscribeUrl}`;

  return { subject, html, text };
}
