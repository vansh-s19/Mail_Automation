import { Router } from "express";
import { z } from "zod";
import { prisma } from "@mail-automation/db";
import { requireAuth } from "../middleware/auth";
import { syncContactsFromSheet } from "../services/sheetsSync";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const contacts = await prisma.contact.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(contacts);
});

const patchSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  isSuppressed: z.boolean().optional(),
});

router.patch("/:id", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid update payload" });
  }

  const contact = await prisma.contact.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json(contact);
});

router.post("/sync-sheet", async (_req, res) => {
  try {
    const report = await syncContactsFromSheet();
    res.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sheet sync failed";
    res.status(502).json({ error: message });
  }
});

export default router;
