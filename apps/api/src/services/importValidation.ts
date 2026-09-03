import { resolveMx } from "node:dns/promises";
import { isValidEmailSyntax, normalizePhone, resolveTimezone } from "@mail-automation/shared";

export interface SheetRow {
  company: string | null;
  name: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  locationRaw: string | null;
  status: string | null;
  source: string | null;
}

const HEADER_ALIASES: Record<keyof SheetRow, string[]> = {
  company: ["company"],
  name: ["person name", "name"],
  title: ["profile", "title", "job title"],
  phone: ["contact", "phone"],
  email: ["mail", "email"],
  locationRaw: ["location"],
  status: ["status"],
  source: ["source"],
};

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Maps header row text -> column index, falling back to the client's known sheet order. */
export function buildColumnIndex(headerRow: string[]): Record<keyof SheetRow, number> {
  const normalizedHeader = headerRow.map((h) => (h ?? "").trim().toLowerCase());
  const index = {} as Record<keyof SheetRow, number>;

  const fallbackOrder: (keyof SheetRow)[] = [
    "company",
    "name",
    "title",
    "phone",
    "email",
    "locationRaw",
    "status",
    "source",
  ];

  for (const field of fallbackOrder) {
    const aliases = HEADER_ALIASES[field];
    const found = normalizedHeader.findIndex((h) => aliases.includes(h));
    index[field] = found;
  }

  // Any field not found by header name falls back to the client's fixed column order.
  fallbackOrder.forEach((field, position) => {
    if (index[field] === -1) index[field] = position;
  });

  return index;
}

export function parseRow(row: string[], columnIndex: Record<keyof SheetRow, number>): SheetRow {
  return {
    company: clean(row[columnIndex.company]),
    name: clean(row[columnIndex.name]),
    title: clean(row[columnIndex.title]),
    phone: normalizePhone(row[columnIndex.phone]),
    email: clean(row[columnIndex.email])?.toLowerCase() ?? null,
    locationRaw: clean(row[columnIndex.locationRaw]),
    status: clean(row[columnIndex.status]),
    source: clean(row[columnIndex.source]),
  };
}

export type RowOutcome = "new" | "updated" | "skipped" | "invalid" | "needs_review";

export interface ValidatedRow {
  row: SheetRow;
  outcome: RowOutcome;
  reason?: string;
  resolvedTimezone: string | null;
}

/**
 * Per spec §13.9: required-field check -> syntax validation -> MX check
 * -> dedup (handled by caller against DB) -> name-presence flag -> timezone resolution.
 */
export async function validateRow(row: SheetRow): Promise<ValidatedRow> {
  if (!row.email) {
    return { row, outcome: "invalid", reason: "Missing email", resolvedTimezone: null };
  }

  if (!isValidEmailSyntax(row.email)) {
    return { row, outcome: "invalid", reason: "Invalid email syntax", resolvedTimezone: null };
  }

  const domain = row.email.split("@")[1];
  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords.length === 0) {
      return { row, outcome: "invalid", reason: "Domain has no MX records", resolvedTimezone: null };
    }
  } catch {
    return { row, outcome: "invalid", reason: "Domain has no MX records", resolvedTimezone: null };
  }

  const resolvedTimezone = resolveTimezone(row.locationRaw);

  if (!row.name) {
    return { row, outcome: "needs_review", reason: "Missing name", resolvedTimezone };
  }

  return { row, outcome: "new", resolvedTimezone };
}
