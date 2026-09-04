import { Router } from "express";
import { prisma } from "@mail-automation/db";
import { verifyOpenTrackingToken } from "@mail-automation/shared";
import { enqueueAutomationSend } from "@mail-automation/queue";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

// 1x1 transparent PNG, served regardless of whether the token is valid -
// this is a tracking pixel embedded in an email, not an API a client checks
// the response of, so it should never 4xx in a way that shows a broken image.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

router.get("/open/:token.png", asyncHandler(async (req, res) => {
  res.set("Content-Type", "image/png");

  const emailSendId = verifyOpenTrackingToken(req.params.token);
  if (!emailSendId) return res.end(PIXEL);

  const emailSend = await prisma.emailSend.findUnique({ where: { id: emailSendId } });
  if (!emailSend) return res.end(PIXEL);

  const alreadyOpened = await prisma.emailEvent.findFirst({
    where: { emailSendId, eventType: "opened" },
  });

  await prisma.emailEvent.create({ data: { emailSendId, eventType: "opened" } });

  // Only the first open schedules automations - re-opens (forwarded, reloaded
  // image cache miss, etc.) shouldn't stack up duplicate follow-up sends. The
  // per-(rule, triggerEmailSendId) unique constraint on AutomationFollowUp is
  // the hard guarantee; this check just avoids the query churn of trying anyway.
  if (!alreadyOpened) {
    const rules = await prisma.sequenceStepAutomation.findMany({
      where: { sequenceStepId: emailSend.sequenceStepId, triggerType: "opened_no_reply", isActive: true },
    });

    for (const rule of rules) {
      const followUp = await prisma.automationFollowUp.upsert({
        where: { automationRuleId_triggerEmailSendId: { automationRuleId: rule.id, triggerEmailSendId: emailSend.id } },
        update: {},
        create: {
          automationRuleId: rule.id,
          triggerEmailSendId: emailSend.id,
          scheduledFor: new Date(Date.now() + rule.triggerDelayHours * 60 * 60 * 1000),
        },
      });
      await enqueueAutomationSend(followUp.id, rule.triggerDelayHours * 60 * 60 * 1000);
    }
  }

  res.end(PIXEL);
}));

export default router;
