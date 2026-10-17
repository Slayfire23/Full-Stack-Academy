import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { http } from "./http";

/**
 * Named in-memory limiters for sensitive or expensive endpoints. Per process; see
 * ARCHITECTURE.md § Rate limiting for the multi-instance caveat. The AI generation quota
 * is additionally enforced from the database in generation.service.ts.
 */
const MIN = 60_000;

// Overridable for test environments (e.g. Playwright, which registers a fresh user per test
// from one IP). Never raise this in production — see .env.example.
const parsedRegisterLimit = Number(process.env.REGISTER_RATE_LIMIT_PER_HOUR);
const registerPerHour = Number.isFinite(parsedRegisterLimit) && parsedRegisterLimit > 0 ? parsedRegisterLimit : 5;

export const limiters = {
  login: new SlidingWindowLimiter(10, 15 * MIN), // per email+IP
  register: new SlidingWindowLimiter(registerPerHour, 60 * MIN), // per IP
  aiFeedback: new SlidingWindowLimiter(20, 60 * MIN), // per user
  writes: new SlidingWindowLimiter(600, 10 * MIN), // per user, generous ceiling on mutations
};

export function enforce(limiter: SlidingWindowLimiter, key: string) {
  const r = limiter.check(key);
  if (!r.allowed) throw http.tooMany(r.retryAfterSeconds);
}
