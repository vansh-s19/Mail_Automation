import cityTimezones from "city-timezones";

/**
 * Resolves a free-text location string (e.g. "Austin, TX" or "New Delhi, Delhi, India")
 * to an IANA timezone. Done once at contact import time, never per-send.
 */
export function resolveTimezone(locationRaw: string | null | undefined): string | null {
  if (!locationRaw) return null;

  const parts = locationRaw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  for (const part of [locationRaw, parts[0]]) {
    const matches = cityTimezones.findFromCityStateProvince(part);
    if (matches.length > 0) {
      return matches[0].timezone;
    }
  }

  return null;
}
