/**
 * Sliding-window rate limiter (in memory).
 *
 * Good for a single Node process (local dev, `next start`, a container). On serverless
 * platforms each instance has its own memory, so this is best-effort there; the AI
 * generation quota is additionally enforced from the database (GeneratedQuestion rows),
 * which is exact across instances. See ARCHITECTURE.md § Rate limiting.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const t = this.now();
    const cutoff = t - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? t;
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - t) / 1000)) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(cutoff);
    return { allowed: true, remaining: this.limit - recent.length, retryAfterSeconds: 0 };
  }

  private prune(cutoff: number) {
    for (const [k, v] of this.hits) {
      const kept = v.filter((ts) => ts > cutoff);
      if (kept.length === 0) this.hits.delete(k);
      else this.hits.set(k, kept);
    }
  }
}
