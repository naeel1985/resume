import "server-only";

/**
 * In-process sliding-window rate limiter.
 *
 * Passenger runs a single long-lived Node process per app on cPanel, so an
 * in-memory map is sufficient and avoids a Redis dependency. If the app is
 * ever scaled to multiple processes this becomes per-process, which is still
 * a useful floor but no longer a global guarantee.
 */

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();
let lastPrune = 0;

const PRUNE_INTERVAL_MS = 60_000;

function prune(now: number, windowMs: number) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  prune(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client IP. Behind cPanel/Apache the real address arrives in
 * `x-forwarded-for`; the left-most entry is the original client.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
