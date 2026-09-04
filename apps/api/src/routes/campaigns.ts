import { Router } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@mail-automation/db";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.use(requireAuth);

const sendingRulesSchema = z.object({
  dailySendCap: z.number().int().positive(),
  businessHoursStart: z.number().int().min(0).max(23),
  businessHoursEnd: z.number().int().min(0).max(23),
  weekendsEnabled: z.boolean(),
});

const DEFAULT_SENDING_RULES = {
  dailySendCap: 100,
  businessHoursStart: 10,
  businessHoursEnd: 17,
  weekendsEnabled: false,
};

// ---- Campaigns ----

router.get("/", asyncHandler(async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { steps: true, campaignContacts: true } },
    },
  });
  res.json(
    campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      sendingRules: c.sendingRules,
      createdAt: c.createdAt,
      stepCount: c._count.steps,
      contactCount: c._count.campaignContacts,
    }))
  );
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: {
      steps: { orderBy: { stepOrder: "asc" }, include: { template: true } },
      campaignContacts: { include: { contact: true } },
    },
  });
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  res.json(campaign);
}));

const campaignCreateSchema = z.object({
  name: z.string().min(1),
  sendingRules: sendingRulesSchema.partial().optional(),
});

router.post("/", asyncHandler(async (req, res) => {
  const parsed = campaignCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid campaign", details: parsed.error.flatten().fieldErrors });
  }
  const campaign = await prisma.campaign.create({
    data: {
      name: parsed.data.name,
      status: "draft",
      sendingRules: { ...DEFAULT_SENDING_RULES, ...parsed.data.sendingRules } as Prisma.InputJsonValue,
    },
  });
  res.status(201).json(campaign);
}));

const campaignUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  sendingRules: sendingRulesSchema.partial().optional(),
});

router.patch("/:id", asyncHandler(async (req, res) => {
  const parsed = campaignUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid campaign", details: parsed.error.flatten().fieldErrors });
  }

  const existing = await prisma.campaign.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Campaign not found" });

  const mergedRules = parsed.data.sendingRules
    ? { ...(existing.sendingRules as Record<string, unknown>), ...parsed.data.sendingRules }
    : undefined;

  const campaign = await prisma.campaign.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(mergedRules ? { sendingRules: mergedRules as Prisma.InputJsonValue } : {}),
    },
  });
  res.json(campaign);
}));

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["paused", "completed", "archived"],
  paused: ["active", "archived"],
  completed: ["archived"],
};

router.post("/:id/:action(launch|pause|resume|archive)", asyncHandler(async (req, res) => {
  const targetStatus: Record<string, string> = {
    launch: "active",
    pause: "paused",
    resume: "active",
    archive: "archived",
  };
  const next = targetStatus[req.params.action];

  const existing = await prisma.campaign.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Campaign not found" });

  if (!VALID_TRANSITIONS[existing.status]?.includes(next)) {
    return res.status(409).json({ error: `Cannot move campaign from ${existing.status} to ${next}` });
  }

  const campaign = await prisma.campaign.update({ where: { id: req.params.id }, data: { status: next } });
  res.json(campaign);
}));

// ---- Sequence steps ----

const stepSchema = z.object({
  templateId: z.string().uuid(),
  delayDays: z.number().int().min(0).default(0),
  delayHours: z.number().int().min(0).max(23).default(0),
});

router.post("/:id/steps", asyncHandler(async (req, res) => {
  const parsed = stepSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid step", details: parsed.error.flatten().fieldErrors });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  const template = await prisma.template.findUnique({ where: { id: parsed.data.templateId } });
  if (!template) return res.status(400).json({ error: "Template not found" });

  const maxOrder = await prisma.sequenceStep.aggregate({
    where: { campaignId: req.params.id },
    _max: { stepOrder: true },
  });

  const step = await prisma.sequenceStep.create({
    data: {
      campaignId: req.params.id,
      templateId: parsed.data.templateId,
      delayDays: parsed.data.delayDays,
      delayHours: parsed.data.delayHours,
      stepOrder: (maxOrder._max.stepOrder ?? -1) + 1,
    },
    include: { template: true },
  });
  res.status(201).json(step);
}));

const stepUpdateSchema = z.object({
  templateId: z.string().uuid().optional(),
  delayDays: z.number().int().min(0).optional(),
  delayHours: z.number().int().min(0).max(23).optional(),
});

router.patch("/steps/:stepId", asyncHandler(async (req, res) => {
  const parsed = stepUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid step", details: parsed.error.flatten().fieldErrors });
  }
  try {
    const step = await prisma.sequenceStep.update({
      where: { id: req.params.stepId },
      data: parsed.data,
      include: { template: true },
    });
    res.json(step);
  } catch {
    res.status(404).json({ error: "Step not found" });
  }
}));

router.delete("/steps/:stepId", asyncHandler(async (req, res) => {
  try {
    await prisma.sequenceStep.delete({ where: { id: req.params.stepId } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Step not found" });
  }
}));

const reorderSchema = z.object({ stepIds: z.array(z.string().uuid()).min(1) });

router.post("/:id/steps/reorder", asyncHandler(async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid reorder payload" });
  }

  // Two-phase update: (campaignId, stepOrder) is unique, so writing final indexes
  // directly can collide with another row's current value mid-transaction
  // (e.g. swapping 0<->1 tries to set row A to 0 while row B is still at 0).
  // Move everything to negative placeholder values first, then to final indexes.
  await prisma.$transaction([
    ...parsed.data.stepIds.map((stepId, index) =>
      prisma.sequenceStep.update({ where: { id: stepId }, data: { stepOrder: -(index + 1) } })
    ),
    ...parsed.data.stepIds.map((stepId, index) =>
      prisma.sequenceStep.update({ where: { id: stepId }, data: { stepOrder: index } })
    ),
  ]);

  const steps = await prisma.sequenceStep.findMany({
    where: { campaignId: req.params.id },
    orderBy: { stepOrder: "asc" },
    include: { template: true },
  });
  res.json(steps);
}));

// ---- Contact enrollment (manual only, per client requirement) ----

const enrollSchema = z.object({ contactIds: z.array(z.string().uuid()).min(1) });

router.post("/:id/contacts", asyncHandler(async (req, res) => {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid enrollment payload" });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  const firstStep = await prisma.sequenceStep.findFirst({
    where: { campaignId: req.params.id },
    orderBy: { stepOrder: "asc" },
  });

  const existing = await prisma.campaignContact.findMany({
    where: { campaignId: req.params.id, contactId: { in: parsed.data.contactIds } },
    select: { contactId: true },
  });
  const alreadyEnrolled = new Set(existing.map((e) => e.contactId));
  const toEnroll = parsed.data.contactIds.filter((id) => !alreadyEnrolled.has(id));

  if (toEnroll.length > 0) {
    await prisma.campaignContact.createMany({
      data: toEnroll.map((contactId) => ({
        campaignId: req.params.id,
        contactId,
        currentStepId: firstStep?.id ?? null,
        state: "pending",
      })),
    });
  }

  res.status(201).json({ enrolled: toEnroll.length, alreadyEnrolled: alreadyEnrolled.size });
}));

router.delete("/:id/contacts/:contactId", asyncHandler(async (req, res) => {
  await prisma.campaignContact.deleteMany({
    where: { campaignId: req.params.id, contactId: req.params.contactId },
  });
  res.status(204).send();
}));

export default router;
