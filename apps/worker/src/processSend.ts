import type { Job } from "bullmq";
import { prisma } from "@mail-automation/db";
import { renderEmailForContact } from "@mail-automation/shared";
import type { SendJobData } from "@mail-automation/queue";
import { sendViaSes, isPermanentSesError } from "./ses";
import { advanceCampaignContact } from "./advanceStep";
import { fetchPdfBytes } from "./s3Documents";

/**
 * A "permanent" outcome resolves the job without retrying (BullMQ only
 * retries on a thrown error) - used both for AWS-rejected sends and for
 * business-logic dead ends like "contact got suppressed since this was queued".
 */
async function markFailed(emailSendId: string, reason: string) {
  await prisma.emailSend.update({
    where: { id: emailSendId },
    data: { currentStatus: "failed" },
  });
  await prisma.emailEvent.create({
    data: { emailSendId, eventType: "failed", eventData: { reason } },
  });
}

export async function processSendJob(job: Job<SendJobData>): Promise<void> {
  const { emailSendId } = job.data;

  const emailSend = await prisma.emailSend.findUnique({
    where: { id: emailSendId },
    include: {
      campaignContact: { include: { contact: true } },
      sequenceStep: { include: { template: true, attachment: true } },
    },
  });

  if (!emailSend) {
    // Nothing to do - row was removed (shouldn't normally happen, but don't retry forever).
    return;
  }

  // Closes the crash-mid-send gap: if a previous attempt got as far as calling
  // SES but crashed before recording the result, this row would already be
  // "sent"/"failed"/"bounced" and re-sending would double-email the contact.
  if (emailSend.currentStatus !== "queued") {
    return;
  }

  const { contact } = emailSend.campaignContact;
  const { template } = emailSend.sequenceStep;

  const suppressed =
    contact.isSuppressed ||
    (await prisma.suppressionList.findUnique({ where: { email: contact.email } })) !== null;

  if (suppressed) {
    await markFailed(emailSendId, "contact suppressed before send");
    return;
  }

  const rendered = renderEmailForContact(template, contact, emailSend.sequenceStep.subjectOverride, emailSend.id);
  const { attachment } = emailSend.sequenceStep;

  try {
    const { messageId } = await sendViaSes({
      to: contact.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachment: attachment
        ? {
            filename: attachment.name.toLowerCase().endsWith(".pdf") ? attachment.name : `${attachment.name}.pdf`,
            content: await fetchPdfBytes(attachment.s3Key),
          }
        : undefined,
    });

    await prisma.emailSend.update({
      where: { id: emailSendId },
      data: {
        currentStatus: "sent",
        providerMessageId: messageId,
        attemptCount: { increment: 1 },
      },
    });
    await prisma.emailEvent.create({
      data: { emailSendId, eventType: "sent", eventData: { messageId } },
    });

    await advanceCampaignContact(emailSend.campaignContactId, emailSend.sequenceStep.campaignId);
  } catch (err) {
    await prisma.emailSend.update({
      where: { id: emailSendId },
      data: { attemptCount: { increment: 1 } },
    });

    if (isPermanentSesError(err)) {
      await markFailed(emailSendId, err instanceof Error ? err.message : "permanent SES error");
      return; // resolved, not thrown - BullMQ won't retry a permanent rejection
    }

    // Transient (throttling, network, etc.) - rethrow so BullMQ's configured
    // retry/backoff (3 attempts, exponential) picks it up.
    throw err;
  }
}
