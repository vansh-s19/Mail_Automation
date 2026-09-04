import { renderMergeTags } from "./mergeTags";
import { env } from "@mail-automation/config";
import { generateUnsubscribeToken } from "./unsubscribeToken";
import { generateOpenTrackingToken } from "./openTrackingToken";
import type { Contact, Template } from "@mail-automation/db";

/**
 * Renders a template for a specific contact - merge tags filled in, plus the
 * unsubscribe footer every outgoing email must carry. This is what the SES
 * worker calls before sending, and what the preview endpoint uses so the
 * client can see a real one before sending is live.
 *
 * `subjectOverride` is a per-sequence-step override (a template is reusable
 * across campaigns/steps, so overriding just the subject line avoids forking
 * the template itself) - pass the step's own value, null/undefined uses the
 * template's subject as before.
 *
 * `emailSendId`, when provided, embeds a 1x1 open-tracking pixel keyed to
 * that specific send (powers the "opened, no reply" automation). Omitted for
 * the template preview endpoint, which has no real EmailSend row to key off.
 */
export function renderEmailForContact(
  template: Template,
  contact: Contact,
  subjectOverride?: string | null,
  emailSendId?: string
): { subject: string; html: string; text: string } {
  const fields = {
    name: contact.name ?? "",
    title: contact.title ?? "",
    company: contact.company ?? "",
    location: contact.locationRaw ?? "",
  };

  const subject = renderMergeTags(subjectOverride ?? template.subject, fields);
  const bodyHtml = renderMergeTags(template.bodyHtml, fields);
  const bodyText = renderMergeTags(template.bodyText ?? "", fields);

  const unsubscribeUrl = `${env.PUBLIC_API_URL}/unsubscribe?token=${generateUnsubscribeToken(contact.id)}`;

  const trackingPixel = emailSendId
    ? `<img src="${env.PUBLIC_API_URL}/track/open/${generateOpenTrackingToken(emailSendId)}.png" width="1" height="1" alt="" style="display:none" />`
    : "";

  const html = `${bodyHtml}<br/><br/><hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px"/><p style="font-size:12px;color:#94a3b8">Don't want future emails? <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a></p>${trackingPixel}`;
  const text = `${bodyText}\n\n---\nDon't want future emails? Unsubscribe: ${unsubscribeUrl}`;

  return { subject, html, text };
}
