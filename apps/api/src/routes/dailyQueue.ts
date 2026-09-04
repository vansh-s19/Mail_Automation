import { Router } from "express";
import { z } from "zod";
import { prisma } from "@mail-automation/db";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { buildDailyQueue, getDailyQueue } from "../services/dailyQueue";

const router = Router();

router.use(requireAuth);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

router.post("/build", asyncHandler(async (req, res) => {
  const dateISO = typeof req.query.date === "string" ? req.query.date : todayISO();
  const result = await buildDailyQueue(dateISO);
  res.json({ date: dateISO, ...result });
}));

router.get("/", asyncHandler(async (req, res) => {
  const dateISO = typeof req.query.date === "string" ? req.query.date : todayISO();
  const rows = await getDailyQueue(dateISO);
  res.json({ date: dateISO, rows });
}));

const bulkActionSchema = z.object({
  queueIds: z.array(z.string().uuid()).min(1),
  action: z.enum(["approve", "exclude"]),
});

router.post("/bulk-action", asyncHandler(async (req, res) => {
  const parsed = bulkActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid bulk action payload" });
  }

  const status = parsed.data.action === "approve" ? "approved" : "excluded";

  const result = await prisma.dailySendQueue.updateMany({
    where: { id: { in: parsed.data.queueIds }, status: "pending_review" },
    data: { status },
  });

  res.json({ updated: result.count });
}));

export default router;
