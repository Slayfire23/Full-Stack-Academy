import { describe, it, expect } from "vitest";
import {
  composeQuiz,
  findWeakTopics,
  selectQuestions,
  shuffleOptions,
  type CandidateQuestion,
  type ComposableQuestion,
  type QuestionHistory,
} from "@/lib/adaptive/selection";
import { createRng } from "@/lib/adaptive/rng";

const NOW = new Date("2026-10-16T12:00:00Z");
const HOUR = 3600_000;
const DAY = 24 * HOUR;

function pool(n: number, topicId = "t1", prefix = "q"): CandidateQuestion[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, topicId }));
}

function hist(p: Partial<QuestionHistory> = {}): QuestionHistory {
  return {
    timesSeen: 1,
    timesCorrect: 1,
    timesIncorrect: 0,
    consecutiveCorrect: 1,
    lastCorrect: true,
    lastSeenAt: new Date(NOW.getTime() - 10 * DAY),
    nextReviewAt: new Date(NOW.getTime() + 10 * DAY),
    ...p,
  };
}

const ids = (r: { picks: { questionId: string }[] }) => r.picks.map((p) => p.questionId);

describe("randomized selection", () => {
  it("is reproducible for the same seed", () => {
    const a = selectQuestions(pool(50), new Map(), { mode: "MIXED", count: 10, now: NOW, seed: 7 });
    const b = selectQuestions(pool(50), new Map(), { mode: "MIXED", count: 10, now: NOW, seed: 7 });
    expect(ids(a)).toEqual(ids(b));
  });

  it("produces different question sets for different seeds", () => {
    const sets = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const r = selectQuestions(pool(60), new Map(), { mode: "NEW", count: 10, now: NOW, seed });
      sets.add([...ids(r)].sort().join(","));
    }
    expect(sets.size).toBeGreaterThan(15);
  });

  it("never returns the same question twice and dedupes the input pool", () => {
    const p = [...pool(10), ...pool(10)];
    const r = selectQuestions(p, new Map(), { mode: "MIXED", count: 10, now: NOW, seed: 3 });
    expect(new Set(ids(r)).size).toBe(10);
  });

  it("reports a shortfall instead of padding when the pool is too small", () => {
    const r = selectQuestions(pool(4), new Map(), { mode: "MIXED", count: 10, now: NOW, seed: 1 });
    expect(r.picks).toHaveLength(4);
    expect(r.diagnostics.shortfall).toBe(6);
  });
});

describe("answer-order randomization", () => {
  it("returns a permutation of the option ids", () => {
    const rng = createRng(11);
    const out = shuffleOptions(["a", "b", "c", "d"], rng);
    expect([...out].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("varies option order across new quizzes", () => {
    const qs: ComposableQuestion[] = [{ id: "q1", topicId: "t1", optionIds: ["a", "b", "c", "d"] }];
    const orders = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const { slots } = composeQuiz(qs, new Map(), { mode: "NEW", count: 1, now: NOW, seed });
      orders.add(slots[0]!.optionOrder.join(""));
    }
    expect(orders.size).toBeGreaterThan(8);
  });

  it("avoids reproducing the authored order for 3+ options", () => {
    let identity = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (shuffleOptions(["a", "b", "c", "d"], createRng(seed)).join("") === "abcd") identity++;
    }
    // Pure chance would be ~8/200; the retry makes it far rarer.
    expect(identity).toBeLessThanOrEqual(1);
  });

  it("leaves questions without options alone", () => {
    const { slots } = composeQuiz([{ id: "q1", topicId: "t1", optionIds: [] }], new Map(), {
      mode: "NEW",
      count: 1,
      now: NOW,
      seed: 1,
    });
    expect(slots[0]!.optionOrder).toEqual([]);
  });
});

describe("recency avoidance", () => {
  const recentHistory = (n: number, hoursAgo: number) =>
    new Map(pool(n, "t1", "r").map((q) => [q.id, hist({ lastSeenAt: new Date(NOW.getTime() - hoursAgo * HOUR) })]));

  it("skips questions answered inside the window when enough alternatives exist", () => {
    const candidates = [...pool(20), ...pool(10, "t1", "r")];
    const history = recentHistory(10, 2);
    for (let seed = 1; seed <= 25; seed++) {
      const r = selectQuestions(candidates, history, { mode: "MIXED", count: 10, now: NOW, seed });
      expect(ids(r).some((id) => id.startsWith("r"))).toBe(false);
      expect(r.diagnostics.usedRecentFallback).toBe(false);
    }
  });

  it("falls back to recent questions only to fill the gap, oldest first", () => {
    const candidates = [...pool(4), ...pool(10, "t1", "r")];
    const history = new Map(
      pool(10, "t1", "r").map((q, i) => [q.id, hist({ lastSeenAt: new Date(NOW.getTime() - (i + 1) * HOUR) })]),
    );
    const r = selectQuestions(candidates, history, { mode: "MIXED", count: 6, now: NOW, seed: 5 });
    expect(r.picks).toHaveLength(6);
    expect(r.diagnostics.usedRecentFallback).toBe(true);
    expect(r.picks.filter((p) => p.reason === "fallback")).toHaveLength(2);
    expect(ids(r).filter((id) => id.startsWith("q"))).toHaveLength(4);
  });

  it("treats questions outside the window as fresh", () => {
    const candidates = pool(10, "t1", "r");
    const history = recentHistory(10, 30); // 30h ago, window 24h
    const r = selectQuestions(candidates, history, { mode: "MIXED", count: 5, now: NOW, seed: 1 });
    expect(r.diagnostics.usedRecentFallback).toBe(false);
  });

  it("honours a custom window (0 disables avoidance)", () => {
    const candidates = [...pool(20), ...pool(10, "t1", "r")];
    const r = selectQuestions(candidates, recentHistory(10, 2), {
      mode: "MIXED",
      count: 30,
      now: NOW,
      seed: 1,
      recentWindowHours: 0,
    });
    expect(r.picks.some((p) => p.reason === "fallback")).toBe(false);
  });
});

describe("prioritising previously incorrect questions", () => {
  const candidates = [...pool(60), ...pool(6, "t1", "x")];
  const history = new Map<string, QuestionHistory>([
    ...pool(60).map((q) => [q.id, hist()] as const),
    ...pool(6, "t1", "x").map(
      (q) => [q.id, hist({ lastCorrect: false, timesCorrect: 0, timesIncorrect: 1, consecutiveCorrect: 0 })] as const,
    ),
  ]);

  it("WEAK mode picks nearly all missed questions first", () => {
    let missed = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = selectQuestions(candidates, history, { mode: "WEAK", count: 8, now: NOW, seed });
      missed += ids(r).filter((id) => id.startsWith("x")).length;
    }
    expect(missed / 20).toBeGreaterThanOrEqual(5); // of 6 possible, vs ~0.7 by chance
  });

  it("MIXED mode still over-represents missed questions", () => {
    let missed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = selectQuestions(candidates, history, { mode: "MIXED", count: 10, now: NOW, seed });
      missed += ids(r).filter((id) => id.startsWith("x")).length;
    }
    // Uniform chance would give 10 * 6/66 ≈ 0.9 per quiz.
    expect(missed / 40).toBeGreaterThan(2.5);
  });

  it("labels them with the 'incorrect' reason", () => {
    const r = selectQuestions(candidates, history, { mode: "WEAK", count: 6, now: NOW, seed: 2 });
    expect(r.picks.filter((p) => p.reason === "incorrect").length).toBeGreaterThanOrEqual(4);
  });
});

describe("spaced-repetition scheduling in selection", () => {
  it("prefers questions whose review is due", () => {
    const candidates = [...pool(40), ...pool(5, "t1", "d")];
    const history = new Map<string, QuestionHistory>([
      ...pool(40).map((q) => [q.id, hist()] as const),
      ...pool(5, "t1", "d").map((q) => [q.id, hist({ nextReviewAt: new Date(NOW.getTime() - 2 * DAY) })] as const),
    ]);
    let due = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = selectQuestions(candidates, history, { mode: "MIXED", count: 8, now: NOW, seed });
      due += r.picks.filter((p) => p.reason === "due").length;
    }
    expect(due / 20).toBeGreaterThanOrEqual(3.5);
  });
});

describe("modes", () => {
  const candidates = [...pool(10, "t1", "u"), ...pool(30)];
  const history = new Map(pool(30).map((q) => [q.id, hist()] as const));

  it("NEW serves unseen questions before anything else", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const r = selectQuestions(candidates, history, { mode: "NEW", count: 8, now: NOW, seed });
      expect(ids(r).every((id) => id.startsWith("u"))).toBe(true);
    }
  });

  it("NEW falls back to the longest-unseen once everything has been seen", () => {
    const all = pool(20);
    const h = new Map(all.map((q, i) => [q.id, hist({ lastSeenAt: new Date(NOW.getTime() - (i + 2) * DAY) })] as const));
    let oldHalf = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = selectQuestions(all, h, { mode: "NEW", count: 5, now: NOW, seed });
      oldHalf += ids(r).filter((id) => Number(id.slice(1)) >= 10).length;
    }
    expect(oldHalf / 20).toBeGreaterThan(2.5);
  });

  it("WEAK concentrates on the weakest topic", () => {
    const strong = pool(20, "strong", "s");
    const weak = pool(20, "weak", "w");
    const h = new Map<string, QuestionHistory>([
      ...strong.map((q) => [q.id, hist({ timesCorrect: 3, timesSeen: 3, consecutiveCorrect: 3 })] as const),
      ...weak.slice(0, 5).map(
        (q) => [q.id, hist({ timesSeen: 2, timesCorrect: 1, timesIncorrect: 1, consecutiveCorrect: 1 })] as const,
      ),
    ]);
    let weakPicks = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = selectQuestions([...strong, ...weak], h, { mode: "WEAK", count: 10, now: NOW, seed, maxTopicShare: 1 });
      weakPicks += r.picks.filter((p) => p.topicId === "weak").length;
      expect(r.diagnostics.weakTopicIds).toContain("weak");
    }
    expect(weakPicks / 20).toBeGreaterThan(8);
  });

  it("MIXED blends new, review and weak material", () => {
    const candidates2 = [
      ...pool(20, "t1", "n"),
      ...pool(20, "t2", "d"),
      ...pool(20, "t3", "s"),
    ];
    const h = new Map<string, QuestionHistory>([
      ...pool(20, "t2", "d").map((q) => [q.id, hist({ nextReviewAt: new Date(NOW.getTime() - DAY) })] as const),
      ...pool(20, "t3", "s").map((q) => [q.id, hist({ consecutiveCorrect: 4, timesCorrect: 4, timesSeen: 4 })] as const),
    ]);
    const r = selectQuestions(candidates2, h, { mode: "MIXED", count: 10, now: NOW, seed: 9 });
    expect(r.diagnostics.byReason.new).toBeGreaterThanOrEqual(3);
    expect(r.diagnostics.byReason.due).toBeGreaterThanOrEqual(3);
  });
});

describe("topic diversity", () => {
  it("caps any one topic at ~40% when several topics are available", () => {
    const candidates = [...pool(30, "big", "b"), ...pool(5, "x", "x"), ...pool(5, "y", "y"), ...pool(5, "z", "z")];
    for (let seed = 1; seed <= 10; seed++) {
      const r = selectQuestions(candidates, new Map(), { mode: "NEW", count: 10, now: NOW, seed });
      expect(r.picks.filter((p) => p.topicId === "big").length).toBeLessThanOrEqual(4);
    }
  });

  it("relaxes the cap rather than returning a short quiz", () => {
    const candidates = [...pool(30, "big", "b"), ...pool(2, "x", "x")];
    const r = selectQuestions(candidates, new Map(), { mode: "NEW", count: 10, now: NOW, seed: 1 });
    expect(r.picks).toHaveLength(10);
  });
});

describe("per-user isolation", () => {
  it("decisions depend only on the history passed in", () => {
    const candidates = [...pool(30), ...pool(5, "t1", "x")];
    const userA = new Map(pool(5, "t1", "x").map((q) => [q.id, hist({ lastCorrect: false, timesCorrect: 0, timesIncorrect: 1, consecutiveCorrect: 0 })] as const));
    const userB = new Map<string, QuestionHistory>();
    const a = selectQuestions(candidates, userA, { mode: "WEAK", count: 5, now: NOW, seed: 4 });
    const b = selectQuestions(candidates, userB, { mode: "WEAK", count: 5, now: NOW, seed: 4 });
    expect(a.picks.filter((p) => p.reason === "incorrect").length).toBeGreaterThan(0);
    expect(b.picks.filter((p) => p.reason === "incorrect")).toHaveLength(0);
  });
});

describe("findWeakTopics", () => {
  it("needs a minimum number of answers before calling a topic weak", () => {
    const w = findWeakTopics(new Map([["t", { attempts: 2, correct: 0 }]]));
    expect(w.size).toBe(0);
  });

  it("flags low-accuracy topics", () => {
    const w = findWeakTopics(
      new Map([
        ["a", { attempts: 10, correct: 3 }],
        ["b", { attempts: 10, correct: 10 }],
      ]),
    );
    expect([...w.keys()]).toEqual(["a"]);
  });

  it("still names the relatively weakest topics when everything is above the bar", () => {
    const w = findWeakTopics(
      new Map([
        ["a", { attempts: 10, correct: 8 }],
        ["b", { attempts: 10, correct: 10 }],
        ["c", { attempts: 10, correct: 10 }],
      ]),
    );
    expect([...w.keys()]).toEqual(["a"]);
  });
});
