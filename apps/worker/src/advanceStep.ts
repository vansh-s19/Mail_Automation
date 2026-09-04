import { prisma } from "@mail-automation/db";

/**
 * Moves a contact to the next sequence step after a successful send, or marks
 * them "completed" after the last step. Without this, `currentStepId` would
 * stay pinned at whatever step they were enrolled with and buildDailyQueue
 * would keep re-queuing the same step forever instead of the sequence
 * actually progressing.
 */
export async function advanceCampaignContact(campaignContactId: string, campaignId: string): Promise<void> {
  const campaignContact = await prisma.campaignContact.findUnique({ where: { id: campaignContactId } });
  if (!campaignContact || !campaignContact.currentStepId) return;

  const steps = await prisma.sequenceStep.findMany({
    where: { campaignId },
    orderBy: { stepOrder: "asc" },
  });

  const currentIndex = steps.findIndex((s) => s.id === campaignContact.currentStepId);
  const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;

  if (nextStep) {
    await prisma.campaignContact.update({
      where: { id: campaignContactId },
      data: { currentStepId: nextStep.id },
    });
  } else {
    await prisma.campaignContact.update({
      where: { id: campaignContactId },
      data: { state: "completed", currentStepId: null },
    });
  }
}
