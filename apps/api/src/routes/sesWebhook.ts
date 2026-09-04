import { Router } from "express";
import { prisma } from "@mail-automation/db";
import { env } from "@mail-automation/config";
import { enqueueSend } from "@mail-automation/queue";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

interface SesBounceNotification {
  notificationType: "Bounce";
  mail: { messageId: string };
  bounce: {
    bounceType: "Permanent" | "Transient" | "Undetermined";
    bouncedRecipients: { emailAddress: string }[];
  };
}

interface SesComplaintNotification {
  notificationType: "Complaint";
  mail: { messageId: string };
  complaint: { complainedRecipients: { emailAddress: string }[] };
}

interface SesDeliveryNotification {
  notificationType: "Delivery";
  mail: { messageId: string };
  delivery: { recipients: string[] };
}

type SesNotification = SesBounceNotification | SesComplaintNotification | SesDeliveryNotification;

async function suppress(email: string, reason: string) {
  await prisma.$transaction([
    prisma.suppressionList.upsert({
      where: { email },
      update: {},
      create: { email, reason },
    }),
    prisma.contact.updateMany({ where: { email }, data: { isSuppressed: true } }),
  ]);
}

async function handleSesNotification(notification: SesNotification) {
  const emailSend = await prisma.emailSend.findFirst({
    where: { providerMessageId: notification.mail.messageId },
  });
  if (!emailSend) return; // Not one of ours, or arrived before the send row was committed.

  if (notification.notificationType === "Bounce") {
    const { bounceType, bouncedRecipients } = notification.bounce;
    await prisma.emailEvent.create({
      data: { emailSendId: emailSend.id, eventType: "bounce", eventData: notification as any },
    });

    if (bounceType === "Permanent") {
      await prisma.emailSend.update({ where: { id: emailSend.id }, data: { currentStatus: "bounced" } });
      for (const r of bouncedRecipients) await suppress(r.emailAddress, "bounced");
      return;
    }

    // Transient (soft) bounce: retry once. A second soft bounce on the same
    // send suppresses the contact rather than retrying indefinitely.
    const priorSoftBounces = await prisma.emailEvent.count({
      where: { emailSendId: emailSend.id, eventType: "bounce" },
    });

    if (priorSoftBounces <= 1) {
      await prisma.emailSend.update({ where: { id: emailSend.id }, data: { currentStatus: "queued" } });
      await enqueueSend(emailSend.id, 0);
    } else {
      await prisma.emailSend.update({ where: { id: emailSend.id }, data: { currentStatus: "bounced" } });
      for (const r of bouncedRecipients) await suppress(r.emailAddress, "bounced");
    }
    return;
  }

  if (notification.notificationType === "Complaint") {
    await prisma.emailEvent.create({
      data: { emailSendId: emailSend.id, eventType: "complaint", eventData: notification as any },
    });
    await prisma.emailSend.update({ where: { id: emailSend.id }, data: { currentStatus: "complained" } });
    for (const r of notification.complaint.complainedRecipients) await suppress(r.emailAddress, "complained");
    return;
  }

  if (notification.notificationType === "Delivery") {
    await prisma.emailEvent.create({
      data: { emailSendId: emailSend.id, eventType: "delivered", eventData: notification as any },
    });
    await prisma.emailSend.update({ where: { id: emailSend.id }, data: { currentStatus: "delivered" } });
  }
}

// SNS posts as `text/plain`, not JSON, so this route needs its raw body parsed
// as text (registered with express.text() in index.ts) rather than the app's
// default express.json() middleware.
router.post(
  "/ses-events",
  asyncHandler(async (req, res) => {
    if (env.SNS_WEBHOOK_SECRET && req.query.secret !== env.SNS_WEBHOOK_SECRET) {
      return res.status(404).end();
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // SNS requires the endpoint to confirm a new subscription by fetching this URL.
    if (body.Type === "SubscriptionConfirmation") {
      await fetch(body.SubscribeURL);
      return res.status(200).end();
    }

    if (body.Type === "Notification") {
      const notification = JSON.parse(body.Message) as SesNotification;
      await handleSesNotification(notification);
    }

    res.status(200).end();
  })
);

export default router;
