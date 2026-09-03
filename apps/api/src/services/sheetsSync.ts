import { prisma, Prisma } from "@mail-automation/db";
import { fetchSheetRows } from "./googleSheetsClient";
import { buildColumnIndex, parseRow, validateRow, ValidatedRow } from "./importValidation";

export interface SyncReport {
  new: number;
  updated: number;
  skipped: number;
  invalid: number;
  needsReview: number;
  total: number;
}

const WRITE_CONCURRENCY = 20;

async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export async function syncContactsFromSheet(): Promise<SyncReport> {
  const rows = await fetchSheetRows();
  if (rows.length === 0) {
    return { new: 0, updated: 0, skipped: 0, invalid: 0, needsReview: 0, total: 0 };
  }

  const [headerRow, ...dataRows] = rows;
  const columnIndex = buildColumnIndex(headerRow);

  const report: SyncReport = { new: 0, updated: 0, skipped: 0, invalid: 0, needsReview: 0, total: dataRows.length };
  const seenEmails = new Set<string>();
  const mxCache = new Map<string, Promise<boolean>>();

  // Pass 1: parse + validate every row (in-memory / DNS only, no DB calls yet).
  const candidates: ValidatedRow[] = [];
  for (const rawRow of dataRows) {
    const parsed = parseRow(rawRow, columnIndex);

    if (parsed.email && seenEmails.has(parsed.email)) {
      report.skipped += 1;
      continue;
    }

    const validated = await validateRow(parsed, mxCache);

    if (validated.outcome === "invalid") {
      report.invalid += 1;
      continue;
    }

    seenEmails.add(validated.row.email as string);
    candidates.push(validated);
  }

  if (candidates.length === 0) {
    return report;
  }

  // Pass 2: one bulk read for existing contacts + one for suppression status,
  // instead of two round-trips per row (this was the actual bottleneck: each
  // round-trip to Railway's Postgres over the public proxy costs ~150-300ms).
  const emails = candidates.map((c) => c.row.email as string);

  const [existingContacts, suppressedEntries] = await Promise.all([
    prisma.contact.findMany({ where: { email: { in: emails } } }),
    prisma.suppressionList.findMany({ where: { email: { in: emails } }, select: { email: true } }),
  ]);

  const existingByEmail = new Map(existingContacts.map((c) => [c.email, c]));
  const suppressedEmails = new Set(suppressedEntries.map((s) => s.email));

  // Pass 3: fire off the actual writes concurrently instead of one-at-a-time.
  await runWithConcurrency(candidates, WRITE_CONCURRENCY, async (validated) => {
    const email = validated.row.email as string;
    const existing = existingByEmail.get(email);
    const suppressed = suppressedEmails.has(email);

    const customFields: Record<string, unknown> = {
      ...(existing?.customFields as Record<string, unknown> | undefined),
      ...(validated.row.status ? { status: validated.row.status } : {}),
      ...(validated.row.source ? { source: validated.row.source } : {}),
      ...(validated.outcome === "needs_review" ? { needsReview: true } : {}),
    };

    if (existing) {
      // Blank cells never overwrite existing non-blank data.
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name: validated.row.name ?? existing.name,
          title: validated.row.title ?? existing.title,
          company: validated.row.company ?? existing.company,
          phone: validated.row.phone ?? existing.phone,
          locationRaw: validated.row.locationRaw ?? existing.locationRaw,
          resolvedTimezone: validated.resolvedTimezone ?? existing.resolvedTimezone,
          customFields: customFields as Prisma.InputJsonValue,
          isSuppressed: suppressed || existing.isSuppressed,
        },
      });
      report.updated += 1;
    } else {
      await prisma.contact.create({
        data: {
          email,
          name: validated.row.name,
          title: validated.row.title,
          company: validated.row.company,
          phone: validated.row.phone,
          locationRaw: validated.row.locationRaw,
          resolvedTimezone: validated.resolvedTimezone,
          customFields: customFields as Prisma.InputJsonValue,
          isSuppressed: suppressed,
        },
      });
      if (validated.outcome === "needs_review") {
        report.needsReview += 1;
      } else {
        report.new += 1;
      }
    }
  });

  return report;
}
