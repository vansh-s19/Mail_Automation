import { DateTime } from "luxon";

/**
 * Resolves "10:00 AM in this contact's timezone, on this calendar date" to
 * the actual UTC instant to send at - handles DST correctly since it's real
 * IANA timezone math (via Luxon), not manual UTC offset arithmetic.
 */
export function localTimeToUtc(dateISO: string, hour: number, timeZone: string): Date {
  const dt = DateTime.fromISO(dateISO, { zone: timeZone }).set({
    hour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return dt.toUTC().toJSDate();
}

/** The contact-local calendar date (YYYY-MM-DD) for a given UTC instant. */
export function utcToLocalDate(instant: Date, timeZone: string): string {
  return DateTime.fromJSDate(instant, { zone: "utc" }).setZone(timeZone).toISODate() as string;
}

/**
 * Local calendar date `daysToAdd` days after `baseInstant`, in the contact's
 * timezone - used to figure out which day a sequence step becomes "due".
 */
export function addLocalDays(baseInstant: Date, daysToAdd: number, timeZone: string): string {
  return (DateTime.fromJSDate(baseInstant, { zone: "utc" }).setZone(timeZone).plus({ days: daysToAdd }).toISODate()) as string;
}

export function isWeekend(dateISO: string, timeZone: string): boolean {
  const weekday = DateTime.fromISO(dateISO, { zone: timeZone }).weekday; // 1=Mon..7=Sun
  return weekday === 6 || weekday === 7;
}
