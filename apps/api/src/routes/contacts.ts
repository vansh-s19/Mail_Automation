import { Router } from "express";
import { z } from "zod";
import { Prisma, prisma } from "@mail-automation/db";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { syncContactsFromSheet } from "../services/sheetsSync";

const router = Router();

router.use(requireAuth);

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;
// Cap for the "select all matching filter" flow in the contact picker - a
// safety ceiling, not an expected real-world campaign size.
const MAX_SELECT_ALL = 5000;

function buildContactWhere(query: Record<string, unknown>): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = {};

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (typeof query.company === "string" && query.company) where.company = query.company;
  if (typeof query.industry === "string" && query.industry) where.industry = query.industry;
  if (typeof query.location === "string" && query.location) where.locationRaw = query.location;

  if (query.status === "active") where.isSuppressed = false;
  if (query.status === "suppressed") where.isSuppressed = true;

  return where;
}

router.get("/", asyncHandler(async (req, res) => {
  const where = buildContactWhere(req.query as Record<string, unknown>);

  // `all=true` returns just matching IDs (no pagination, no full rows) - used
  // by the contact picker's "Select all matching filter" action, which needs
  // every id but not the weight of every field for potentially thousands of rows.
  if (req.query.all === "true") {
    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true },
      take: MAX_SELECT_ALL,
    });
    return res.json({ ids: contacts.map((c) => c.id) });
  }

  const skip = Math.max(0, Number(req.query.skip) || 0);
  const take = Math.min(MAX_TAKE, Math.max(1, Number(req.query.take) || DEFAULT_TAKE));

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.contact.count({ where }),
  ]);

  res.json({ contacts, total });
}));

// Distinct values for the Company/Industry/Location filter dropdowns - kept
// as its own lightweight endpoint so the frontend never has to load every
// contact just to know what values exist to filter by.
router.get("/filter-options", asyncHandler(async (_req, res) => {
  const [companies, industries, locations] = await Promise.all([
    prisma.contact.findMany({ where: { company: { not: null } }, select: { company: true }, distinct: ["company"] }),
    prisma.contact.findMany({ where: { industry: { not: null } }, select: { industry: true }, distinct: ["industry"] }),
    prisma.contact.findMany({ where: { locationRaw: { not: null } }, select: { locationRaw: true }, distinct: ["locationRaw"] }),
  ]);

  res.json({
    companies: companies.map((c) => c.company).filter(Boolean).sort(),
    industries: industries.map((c) => c.industry).filter(Boolean).sort(),
    locations: locations.map((c) => c.locationRaw).filter(Boolean).sort(),
  });
}));

const patchSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  isSuppressed: z.boolean().optional(),
});

router.patch("/:id", asyncHandler(async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid update payload" });
  }

  try {
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(contact);
  } catch {
    res.status(404).json({ error: "Contact not found" });
  }
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const contact = await prisma.contact.findUnique({ where: { id: req.params.id } });
  if (!contact) return res.status(404).json({ error: "Contact not found" });

  const enrollmentCount = await prisma.campaignContact.count({ where: { contactId: contact.id } });
  if (enrollmentCount > 0) {
    return res.status(409).json({ error: "Contact is enrolled in one or more campaigns - remove them from those campaigns first" });
  }

  await prisma.contact.delete({ where: { id: contact.id } });
  res.status(204).send();
}));

router.post("/sync-sheet", asyncHandler(async (_req, res) => {
  try {
    const report = await syncContactsFromSheet();
    res.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sheet sync failed";
    res.status(502).json({ error: message });
  }
}));

export default router;
