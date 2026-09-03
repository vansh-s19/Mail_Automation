/**
 * Google Sheets/Excel stores long numeric-looking cells (like phone numbers)
 * in scientific notation, e.g. "7.760968855E9". Normalize back to plain digits.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  if (/^[\d.]+E\+?\d+$/i.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      return Math.round(asNumber).toString();
    }
  }

  return trimmed;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailSyntax(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email.trim());
}
