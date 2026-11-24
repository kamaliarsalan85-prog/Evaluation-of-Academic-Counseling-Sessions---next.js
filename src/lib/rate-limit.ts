interface BucketEntry {
  timestamps: number[];
}

const buckets = new Map<string, BucketEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  const cutoff = now - windowMs;
  const entry = buckets.get(key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0] ?? now;
    const retryAfterMs = Math.max(1000, oldestInWindow + windowMs - now);
    buckets.set(key, entry);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  entry.timestamps.push(now);
  buckets.set(key, entry);

  // Prevent unbounded growth in long-running processes
  if (buckets.size > 5000) {
    for (const [k, v] of buckets.entries()) {
      if (v.timestamps.length === 0 || (v.timestamps[v.timestamps.length - 1] ?? 0) <= cutoff) {
        buckets.delete(k);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - entry.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitForTests() {
  buckets.clear();
}
