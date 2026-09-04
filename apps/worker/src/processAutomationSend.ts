import type { Job } from "bullmq";
import { prisma } from "@mail-automation/db";
import { renderEmailForContact } from "@mail-automation/shared";
import type { AutomationJobData } from "@mail-automation/queue";
import { sendViaSes, isPermanentSesError } from "./ses";

export async function processAutomationSendJob(job: Job<AutomationJobData>): Promise<void> {
  const { followUpId } = job.data;

  const followUp = await prisma.automationFollowUp.findUnique({
    where: { id: followUpId },
    include: {
      automationRule: { include: { actionTemplate: true } },
      triggerEmailSend: { include: { campaignContact: { include: { contact: true } } } },
    },
  });

  if (!followUp || followUp.status !== "scheduled") {
    // Not found, already sent/failed, or cancelled (e.g. by a reply) - either
    // way there's nothing left for this job to do.
    return;
  }

  const replied = await prisma.emailEvent.findFirst({
    where: { emailSendId: followUp.triggerEmailSendId, eventType: "replied" },
  });

  if (replied) {
    await prisma.automationFollowUp.update({ where: { id: followUpId }, data: { status: "cancelled" } });
    return;
  }

  const { contact } = followUp.triggerEmailSend.campaignContact;

  const suppressed =
    contact.isSuppressed ||
    (await prisma.suppressionList.findUnique({ where: { email: contact.email } })) !== null;

  if (suppressed) {
    await prisma.automationFollowUp.update({ where: { id: followUpId }, data: { status: "cancelled" } });
    return;
  }

  const rendered = renderEmailForContact(followUp.automationRule.actionTemplate, contact);

  try {
    const { messageId } = await sendViaSes({
      to: contact.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await prisma.automationFollowUp.update({
      where: { id: followUpId },
      data: { status: "sent", providerMessageId: messageId },
    });
  } catch (err) {
    if (isPermanentSesError(err)) {
      await prisma.automationFollowUp.update({ where: { id: followUpId }, data: { status: "failed" } });
      return;
    }
    throw err; // transient - let BullMQ retry
  }
}
