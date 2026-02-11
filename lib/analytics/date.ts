const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function partsToDateKey(parts: Intl.DateTimeFormatPart[]): string {
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve date parts for timezone");
  }

  return `${year}-${month}-${day}`;
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";

  try {
    const normalized = Intl.DateTimeFormat("en-US", {
      timeZone,
    }).resolvedOptions().timeZone;
    return normalized || "UTC";
  } catch {
    return "UTC";
  }
}

export function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return partsToDateKey(formatter.formatToParts(date));
}

export function toUtcDateFromDateKey(dateKey: string): Date {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function toDateKeyFromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const base = toUtcDateFromDateKey(dateKey);
  base.setUTCDate(base.getUTCDate() + days);
  return toDateKeyFromUtcDate(base);
}

export function getTodayDateKeyInTimeZone(
  timeZone: string,
  now: Date = new Date()
): string {
  return getDateKeyInTimeZone(now, timeZone);
}

export function getRecentDateKeysInTimeZone(
  timeZone: string,
  days: number,
  now: Date = new Date()
): string[] {
  const today = getTodayDateKeyInTimeZone(timeZone, now);
  const keys: string[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    keys.push(shiftDateKey(today, -i));
  }

  return keys;
}

export function daysBetweenDateKeys(a: string, b: string): number {
  const aDate = toUtcDateFromDateKey(a).getTime();
  const bDate = toUtcDateFromDateKey(b).getTime();
  return Math.floor((aDate - bDate) / (24 * 60 * 60 * 1000));
}
