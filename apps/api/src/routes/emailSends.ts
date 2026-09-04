import { Router } from "express";
import { prisma } from "@mail-automation/db";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.use(requireAuth);

// Interim manual reply gate: real IMAP-based reply detection isn't built yet
// (blocked on getting mailbox credentials), so this is how the "opened, no
// reply" automation gets told a contact already replied by hand, so it
// doesn't send a redundant follow-up. The automation worker checks for this
// exact eventType before firing.
router.post("/:id/mark-replied", asyncHandler(async (req, res) => {
  const emailSend = await prisma.emailSend.findUnique({ where: { id: req.params.id } });
  if (!emailSend) return res.status(404).json({ error: "Email send not found" });

  const existing = await prisma.emailEvent.findFirst({
    where: { emailSendId: emailSend.id, eventType: "replied" },
  });
  if (!existing) {
    await prisma.emailEvent.create({ data: { emailSendId: emailSend.id, eventType: "replied" } });
  }

  res.status(204).send();
}));

export default router;
