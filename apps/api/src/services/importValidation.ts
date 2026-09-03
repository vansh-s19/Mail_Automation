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

const MX_LOOKUP_TIMEOUT_MS = 5000;

/**
 * A sheet with hundreds of rows typically has a handful of unique domains
 * (colleagues share a company domain). Caching per-domain avoids repeating
 * the same DNS lookup for every row, and the timeout keeps one slow/unresponsive
 * domain from stalling the whole sync.
 */
async function domainHasMx(domain: string, cache: Map<string, Promise<boolean>>): Promise<boolean> {
  const cached = cache.get(domain);
  if (cached) return cached;

  const lookup = (async () => {
    try {
      const mxRecords = await Promise.race([
        resolveMx(domain),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("MX lookup timed out")), MX_LOOKUP_TIMEOUT_MS)
        ),
      ]);
      return mxRecords.length > 0;
    } catch {
      return false;
    }
  })();

  cache.set(domain, lookup);
  return lookup;
}

/**
 * Per spec §13.9: required-field check -> syntax validation -> MX check
 * -> dedup (handled by caller against DB) -> name-presence flag -> timezone resolution.
 *
 * `mxCache` should be a single Map passed in by the caller and reused across
 * every row in one sync run, so repeated domains only trigger one DNS lookup.
 */
export async function validateRow(
  row: SheetRow,
  mxCache: Map<string, Promise<boolean>>
): Promise<ValidatedRow> {
  if (!row.email) {
    return { row, outcome: "invalid", reason: "Missing email", resolvedTimezone: null };
  }

  if (!isValidEmailSyntax(row.email)) {
    return { row, outcome: "invalid", reason: "Invalid email syntax", resolvedTimezone: null };
  }

  const domain = row.email.split("@")[1];
  const hasMx = await domainHasMx(domain, mxCache);
  if (!hasMx) {
    return { row, outcome: "invalid", reason: "Domain has no MX records", resolvedTimezone: null };
  }

  const resolvedTimezone = resolveTimezone(row.locationRaw);

  if (!row.name) {
    return { row, outcome: "needs_review", reason: "Missing name", resolvedTimezone };
  }

  return { row, outcome: "new", resolvedTimezone };
}
