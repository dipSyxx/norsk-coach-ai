/**
 * Simple in-memory rate limiter for chat. Resets on cold start.
 * Limit: MAX_REQUESTS per WINDOW_MS per userId.
 */
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;

const hits = new Map<string, number[]>();

function prune(ts: number[]): number[] {
  const cutoff = Date.now() - WINDOW_MS;
  return ts.filter((t) => t > cutoff);
}

export function checkRateLimit(userId: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  let timestamps = hits.get(userId) ?? [];
  timestamps = prune(timestamps);

  if (timestamps.length >= MAX_REQUESTS) {
    const oldest = Math.min(...timestamps);
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  timestamps.push(now);
  hits.set(userId, timestamps);
  return { ok: true };
}
