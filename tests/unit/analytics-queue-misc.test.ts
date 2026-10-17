import { describe, it, expect } from "vitest";
import {
  computeStreak,
  dailySeries,
  dayKey,
  overallAccuracy,
  rankTopics,
  recommendNextTopic,
  studyMinutes,
  topicStats,
  type TopicSignal,
} from "@/lib/adaptive/analytics";
import { buildReviewQueue, dueForecast } from "@/lib/adaptive/review-queue";
import { createRng, seedFromString, weightedSample } from "@/lib/adaptive/rng";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import type { QuestionHistory } from "@/lib/adaptive/selection";

const NOW = new Date("2026-10-16T12:00:00Z");
const DAY = 86_400_000;

describe("streaks", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-10-14", "2026-10-15", "2026-10-16"], "2026-10-16")).toEqual({ current: 3, longest: 3 });
  });
  it("keeps yesterday's streak alive before today's session", () => {
    expect(computeStreak(["2026-10-14", "2026-10-15"], "2026-10-16").current).toBe(2);
  });
  it("breaks on a missed day and tracks the longest run", () => {
    expect(computeStreak(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-03", "2026-10-15"], "2026-10-16")).toEqual({
      current: 1,
      longest: 3,
    });
  });
  it("is zero for a new user", () => {
    expect(computeStreak([], "2026-10-16")).toEqual({ current: 0, longest: 0 });
  });
  it("handles month boundaries", () => {
    expect(computeStreak(["2026-09-30", "2026-10-01"], "2026-10-01").current).toBe(2);
  });
  it("uses the user's time zone for day boundaries", () => {
    const lateEvening = new Date("2026-10-17T03:30:00Z"); // 22:30 in Chicago on the 16th
    expect(dayKey(lateEvening, "UTC")).toBe("2026-10-17");
    expect(dayKey(lateEvening, "America/Chicago")).toBe("2026-10-16");
  });
});

describe("topic stats and ranking", () => {
  const attempts = [
    ...Array.from({ length: 4 }, (_, i) => ({ topicId: "sql", correct: i === 0, createdAt: NOW })),
    ...Array.from({ length: 5 }, () => ({ topicId: "http", correct: true, createdAt: NOW })),
    { topicId: "redis", correct: false, createdAt: NOW },
  ];

  it("computes per-topic accuracy", () => {
    const s = topicStats(attempts);
    expect(s.find((t) => t.topicId === "sql")?.accuracy).toBe(0.25);
  });

  it("ignores topics with too few answers when ranking", () => {
    const { weakest, strongest } = rankTopics(topicStats(attempts));
    expect(weakest.map((t) => t.topicId)).toEqual(["sql"]);
    expect(strongest.map((t) => t.topicId)).toEqual(["http"]);
    expect([...weakest, ...strongest].some((t) => t.topicId === "redis")).toBe(false);
  });

  it("reports null accuracy (not 0%) for a user with no answers", () => {
    expect(overallAccuracy([])).toBeNull();
  });

  it("builds a zero-filled daily series", () => {
    const series = dailySeries([{ topicId: "x", correct: true, createdAt: new Date(NOW.getTime() - DAY) }], NOW, 7);
    expect(series).toHaveLength(7);
    expect(series[5]).toEqual({ day: "2026-10-15", answered: 1, correct: 1 });
    expect(series[6]!.answered).toBe(0);
  });

  it("caps idle session time", () => {
    const start = new Date(NOW.getTime() - 10 * 3600_000);
    expect(studyMinutes([{ startedAt: start, lastActivityAt: NOW, endedAt: null }])).toBe(180);
    expect(studyMinutes([{ startedAt: new Date(NOW.getTime() - 25 * 60_000), lastActivityAt: NOW, endedAt: NOW }])).toBe(25);
  });
});

describe("next-topic recommendation", () => {
  const base = (p: Partial<TopicSignal>): TopicSignal => ({
    topicId: "t",
    title: "T",
    order: 0,
    dueCount: 0,
    recentErrors: 0,
    attempts: 0,
    correct: 0,
    unseenCount: 5,
    ...p,
  });

  it("labels a new user's recommendation as a starting point, not analysis", () => {
    const r = recommendNextTopic([base({ topicId: "b", order: 2 }), base({ topicId: "a", order: 1 })]);
    expect(r?.topicId).toBe("a");
    expect(r?.basis).toBe("starting-point");
  });

  it("prefers topics with due cards and recent mistakes", () => {
    const r = recommendNextTopic([
      base({ topicId: "calm", attempts: 10, correct: 9 }),
      base({ topicId: "hot", attempts: 10, correct: 5, dueCount: 4, recentErrors: 3 }),
    ]);
    expect(r?.topicId).toBe("hot");
    expect(r?.basis).toBe("history");
    expect(r?.reasons.join(" ")).toMatch(/due/);
  });
});

describe("flashcard review queue", () => {
  const h = (p: Partial<QuestionHistory>): QuestionHistory => ({
    timesSeen: 1,
    timesCorrect: 1,
    timesIncorrect: 0,
    consecutiveCorrect: 1,
    lastCorrect: true,
    lastSeenAt: new Date(NOW.getTime() - 3 * DAY),
    nextReviewAt: new Date(NOW.getTime() - DAY),
    ...p,
  });
  const candidates = ["d1", "d2", "later", "n1", "n2", "n3"].map((id) => ({ id, topicId: "t" }));
  const history = new Map<string, QuestionHistory>([
    ["d1", h({ nextReviewAt: new Date(NOW.getTime() - 3 * DAY) })],
    ["d2", h({ nextReviewAt: new Date(NOW.getTime() - DAY) })],
    ["later", h({ nextReviewAt: new Date(NOW.getTime() + 5 * DAY) })],
  ]);

  it("serves due cards (most overdue first), skips not-yet-due cards and caps new cards", () => {
    const q = buildReviewQueue(candidates, history, { now: NOW, seed: 1, limit: 10, newLimit: 2 });
    const ids = q.map((i) => i.questionId);
    expect(ids.indexOf("d1")).toBeLessThan(ids.indexOf("d2"));
    expect(ids).not.toContain("later");
    expect(q.filter((i) => i.kind === "new")).toHaveLength(2);
  });

  it("can exclude new cards entirely (review-only queue)", () => {
    const q = buildReviewQueue(candidates, history, { now: NOW, seed: 1, limit: 10, newLimit: 5, includeNew: false });
    expect(q.map((i) => i.questionId)).toEqual(["d1", "d2"]);
  });

  it("forecasts due counts, folding overdue into today", () => {
    const f = dueForecast(history.values(), NOW, 7);
    expect(f[0]).toBe(2);
    expect(f[5]).toBe(1);
  });
});

describe("rng", () => {
  it("weightedSample never picks zero-weight items and respects k", () => {
    const items = ["a", "b", "c", "d"];
    const out = weightedSample(items, (x) => (x === "d" ? 0 : 1), 10, createRng(1));
    expect(out).toHaveLength(3);
    expect(out).not.toContain("d");
  });
  it("seedFromString is stable", () => {
    expect(seedFromString("user-1:2026-10-16")).toBe(seedFromString("user-1:2026-10-16"));
    expect(seedFromString("a")).not.toBe(seedFromString("b"));
  });
});

describe("rate limiter", () => {
  it("allows up to the limit inside the window, then reports retry-after", () => {
    let t = 0;
    const rl = new SlidingWindowLimiter(3, 60_000, () => t);
    expect(rl.check("ip").allowed).toBe(true);
    expect(rl.check("ip").allowed).toBe(true);
    expect(rl.check("ip").remaining).toBe(0);
    const blocked = rl.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
    expect(rl.check("other").allowed).toBe(true);
    t = 60_001;
    expect(rl.check("ip").allowed).toBe(true);
  });
});
