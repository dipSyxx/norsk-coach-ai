const DAY_MS = 24 * 60 * 60 * 1000;

export const SRS_INTERVAL_DAYS = [0.5, 1, 3, 7, 14, 30] as const;

export function clampStrength(strength: number): number {
  return Math.min(5, Math.max(0, Math.trunc(strength)));
}

export function getSrsIntervalDays(strength: number): number {
  return SRS_INTERVAL_DAYS[clampStrength(strength)] ?? 1;
}

export function computeNextReviewAtFromStrength(strength: number): Date {
  return new Date(Date.now() + getSrsIntervalDays(strength) * DAY_MS);
}
