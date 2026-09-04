import { Router } from "express";
import { z } from "zod";
import { prisma } from "@mail-automation/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  res.json(templates);
});

router.get("/:id", async (req, res) => {
  const template = await prisma.template.findUnique({ where: { id: req.params.id } });
  if (!template) return res.status(404).json({ error: "Template not found" });
  res.json(template);
});

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid template", details: parsed.error.flatten().fieldErrors });
  }
  const template = await prisma.template.create({ data: parsed.data });
  res.status(201).json(template);
});

const templateUpdateSchema = templateSchema.partial();

router.patch("/:id", async (req, res) => {
  const parsed = templateUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid template", details: parsed.error.flatten().fieldErrors });
  }
  try {
    const template = await prisma.template.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(template);
  } catch {
    res.status(404).json({ error: "Template not found" });
  }
});

router.delete("/:id", async (req, res) => {
  const usedInStep = await prisma.sequenceStep.findFirst({ where: { templateId: req.params.id } });
  if (usedInStep) {
    return res.status(409).json({ error: "Template is used in a campaign sequence and can't be deleted" });
  }
  try {
    await prisma.template.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Template not found" });
  }
});

export default router;
