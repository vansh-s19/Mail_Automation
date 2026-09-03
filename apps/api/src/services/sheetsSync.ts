import { prisma, Prisma } from "@mail-automation/db";
import { fetchSheetRows } from "./googleSheetsClient";
import { buildColumnIndex, parseRow, validateRow } from "./importValidation";

export interface SyncReport {
  new: number;
  updated: number;
  skipped: number;
  invalid: number;
  needsReview: number;
  total: number;
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

  for (const rawRow of dataRows) {
    const parsed = parseRow(rawRow, columnIndex);

    // Duplicate within this same sync batch (not against the DB, which is an update instead).
    if (parsed.email && seenEmails.has(parsed.email)) {
      report.skipped += 1;
      continue;
    }

    const validated = await validateRow(parsed);

    if (validated.outcome === "invalid") {
      report.invalid += 1;
      continue;
    }

    seenEmails.add(validated.row.email as string);

    const suppressed = await prisma.suppressionList.findUnique({
      where: { email: validated.row.email as string },
    });

    const existing = await prisma.contact.findUnique({ where: { email: validated.row.email as string } });

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
          isSuppressed: !!suppressed || existing.isSuppressed,
        },
      });
      report.updated += 1;
    } else {
      await prisma.contact.create({
        data: {
          email: validated.row.email as string,
          name: validated.row.name,
          title: validated.row.title,
          company: validated.row.company,
          phone: validated.row.phone,
          locationRaw: validated.row.locationRaw,
          resolvedTimezone: validated.resolvedTimezone,
          customFields: customFields as Prisma.InputJsonValue,
          isSuppressed: !!suppressed,
        },
      });
      if (validated.outcome === "needs_review") {
        report.needsReview += 1;
      } else {
        report.new += 1;
      }
    }
  }

  return report;
}
