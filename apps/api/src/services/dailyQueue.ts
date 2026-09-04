import { prisma } from "@mail-automation/db";
import { addLocalDays, localTimeToUtc, isWeekend } from "@mail-automation/shared";
import { env } from "@mail-automation/config";

interface SendingRules {
  dailySendCap: number;
  businessHoursStart: number;
  businessHoursEnd: number;
  weekendsEnabled: boolean;
}

/**
 * Computes which enrolled contacts are due for their next sequence step on
 * `dateISO` (defaults to today), and inserts pending_review rows into
 * daily_send_queue. Per spec §13.3: only active campaigns, not yet suppressed/
 * stopped, delay elapsed relative to their last send (or enrollment, for the
 * first step). Idempotent - running twice for the same date doesn't duplicate.
 */
export async function buildDailyQueue(dateISO: string): Promise<{ added: number; skipped: number }> {
  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "active" },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  let added = 0;
  let skipped = 0;

  for (const campaign of activeCampaigns) {
    const rules = campaign.sendingRules as unknown as SendingRules;

    const campaignContacts = await prisma.campaignContact.findMany({
      where: { campaignId: campaign.id, state: "pending" },
      include: { contact: true },
    });

    for (const cc of campaignContacts) {
      if (cc.contact.isSuppressed) {
        skipped += 1;
        continue;
      }
      if (!cc.currentStepId) {
        skipped += 1;
        continue;
      }

      const currentStep = campaign.steps.find((s) => s.id === cc.currentStepId);
      if (!currentStep) {
        skipped += 1;
        continue;
      }

      const timeZone = cc.contact.resolvedTimezone ?? env.DEFAULT_TIMEZONE_FALLBACK;

      // Base = when the previous step actually went out, or enrollment time for step 0.
      const lastSend = await prisma.emailSend.findFirst({
        where: { campaignContactId: cc.id },
        orderBy: { scheduledFor: "desc" },
      });
      const base = lastSend?.scheduledFor ?? cc.enrolledAt;

      const dueDateLocal = addLocalDays(base, currentStep.delayDays, timeZone);

      if (dueDateLocal > dateISO) {
        // Not due yet.
        continue;
      }

      if (!rules.weekendsEnabled && isWeekend(dateISO, timeZone)) {
        continue;
      }

      const existing = await prisma.dailySendQueue.findFirst({
        where: {
          campaignContactId: cc.id,
          sequenceStepId: currentStep.id,
          targetDate: new Date(dateISO),
        },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await prisma.dailySendQueue.create({
        data: {
          campaignContactId: cc.id,
          sequenceStepId: currentStep.id,
          targetDate: new Date(dateISO),
          status: "pending_review",
        },
      });
      added += 1;
    }
  }

  return { added, skipped };
}

export interface DailyQueueRow {
  id: string;
  status: string;
  targetDate: Date;
  scheduledLocalSendTime: Date;
  contact: { id: string; name: string | null; email: string; company: string | null; resolvedTimezone: string | null };
  campaign: { id: string; name: string };
  step: { id: string; stepOrder: number; templateName: string; templateSubject: string };
}

export async function getDailyQueue(dateISO: string): Promise<DailyQueueRow[]> {
  const rows = await prisma.dailySendQueue.findMany({
    where: { targetDate: new Date(dateISO) },
    include: {
      campaignContact: { include: { contact: true, campaign: true } },
      sequenceStep: { include: { template: true } },
    },
    orderBy: { id: "asc" },
  });

  return rows.map((row) => {
    const timeZone = row.campaignContact.contact.resolvedTimezone ?? env.DEFAULT_TIMEZONE_FALLBACK;
    const rules = row.campaignContact.campaign.sendingRules as unknown as SendingRules;
    const scheduledLocalSendTime = localTimeToUtc(dateISO, rules.businessHoursStart, timeZone);

    return {
      id: row.id,
      status: row.status,
      targetDate: row.targetDate,
      scheduledLocalSendTime,
      contact: {
        id: row.campaignContact.contact.id,
        name: row.campaignContact.contact.name,
        email: row.campaignContact.contact.email,
        company: row.campaignContact.contact.company,
        resolvedTimezone: row.campaignContact.contact.resolvedTimezone,
      },
      campaign: { id: row.campaignContact.campaign.id, name: row.campaignContact.campaign.name },
      step: {
        id: row.sequenceStep.id,
        stepOrder: row.sequenceStep.stepOrder,
        templateName: row.sequenceStep.template.name,
        templateSubject: row.sequenceStep.template.subject,
      },
    };
  });
}
