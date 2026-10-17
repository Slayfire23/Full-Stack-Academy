import { describe, it, expect } from "vitest";
import { applyOutcome, emptyProgress, initialSrsState, scheduleReview, SRS, type SrsState } from "@/lib/adaptive/srs";

const NOW = new Date("2026-10-16T12:00:00Z");
const DAY = 86_400_000;
const daysUntil = (d: Date) => (d.getTime() - NOW.getTime()) / DAY;

describe("scheduleReview", () => {
  it("GOOD on a new card graduates to 1 day, then 6, then interval × ease", () => {
    let s: SrsState = initialSrsState();
    const r1 = scheduleReview(s, "GOOD", NOW);
    expect(r1.intervalDays).toBe(1);
    expect(daysUntil(r1.nextReviewAt)).toBe(1);
    s = r1;
    const r2 = scheduleReview(s, "GOOD", NOW);
    expect(r2.intervalDays).toBe(6);
    s = r2;
    const r3 = scheduleReview(s, "GOOD", NOW);
    expect(r3.intervalDays).toBe(15); // round(6 × 2.5)
    expect(r3.repetitions).toBe(3);
  });

  it("AGAIN resets repetitions, schedules a 10-minute relearn and lowers ease", () => {
    const s = { repetitions: 4, intervalDays: 20, easeFactor: 2.5, lapses: 0 };
    const r = scheduleReview(s, "AGAIN", NOW);
    expect(r.repetitions).toBe(0);
    expect(r.intervalDays).toBe(0);
    expect(r.lapses).toBe(1);
    expect(r.easeFactor).toBeCloseTo(2.3);
    expect(r.nextReviewAt.getTime() - NOW.getTime()).toBe(SRS.relearnMinutes * 60_000);
  });

  it("HARD grows the interval slowly and lowers ease", () => {
    const r = scheduleReview({ repetitions: 3, intervalDays: 10, easeFactor: 2.5, lapses: 0 }, "HARD", NOW);
    expect(r.intervalDays).toBe(12);
    expect(r.easeFactor).toBeCloseTo(2.35);
  });

  it("EASY jumps further and raises ease", () => {
    const first = scheduleReview(initialSrsState(), "EASY", NOW);
    expect(first.intervalDays).toBe(4);
    const r = scheduleReview({ repetitions: 3, intervalDays: 10, easeFactor: 2.5, lapses: 0 }, "EASY", NOW);
    expect(r.easeFactor).toBeCloseTo(2.65);
    expect(r.intervalDays).toBe(Math.round(10 * 2.65 * 1.3));
  });

  it("orders intervals AGAIN < HARD < GOOD < EASY for the same state", () => {
    const s = { repetitions: 3, intervalDays: 10, easeFactor: 2.5, lapses: 0 };
    const [a, h, g, e] = (["AGAIN", "HARD", "GOOD", "EASY"] as const).map((r) => scheduleReview(s, r, NOW).intervalDays);
    expect(a!).toBeLessThan(h!);
    expect(h!).toBeLessThan(g!);
    expect(g!).toBeLessThan(e!);
  });

  it("clamps ease to [1.3, 3.0]", () => {
    let s: SrsState = { repetitions: 2, intervalDays: 6, easeFactor: 1.35, lapses: 0 };
    s = scheduleReview(s, "AGAIN", NOW);
    expect(s.easeFactor).toBe(1.3);
    let e: SrsState = { repetitions: 2, intervalDays: 6, easeFactor: 2.95, lapses: 0 };
    e = scheduleReview(e, "EASY", NOW);
    expect(e.easeFactor).toBe(3.0);
  });

  it("caps intervals at 365 days", () => {
    const r = scheduleReview({ repetitions: 9, intervalDays: 300, easeFactor: 3, lapses: 0 }, "EASY", NOW);
    expect(r.intervalDays).toBe(365);
  });

  it("always moves a successful card forward, even at minimum ease", () => {
    const r = scheduleReview({ repetitions: 5, intervalDays: 2, easeFactor: 1.3, lapses: 3 }, "HARD", NOW);
    expect(r.intervalDays).toBeGreaterThan(2);
  });

  it("is deterministic", () => {
    const s = { repetitions: 3, intervalDays: 9, easeFactor: 2.2, lapses: 1 };
    expect(scheduleReview(s, "GOOD", NOW)).toEqual(scheduleReview(s, "GOOD", NOW));
  });
});

describe("applyOutcome", () => {
  it("updates counters and schedule for a correct quiz answer", () => {
    const { progress, rating } = applyOutcome(emptyProgress(), { kind: "graded", correct: true }, NOW);
    expect(rating).toBe("GOOD");
    expect(progress.timesSeen).toBe(1);
    expect(progress.timesCorrect).toBe(1);
    expect(progress.consecutiveCorrect).toBe(1);
    expect(progress.lastCorrect).toBe(true);
    expect(progress.nextReviewAt?.getTime()).toBe(NOW.getTime() + DAY);
  });

  it("resets the streak and schedules relearning after a wrong answer", () => {
    const start = { ...emptyProgress(), consecutiveCorrect: 3, timesSeen: 3, timesCorrect: 3, repetitions: 3, intervalDays: 15 };
    const { progress } = applyOutcome(start, { kind: "graded", correct: false }, NOW);
    expect(progress.consecutiveCorrect).toBe(0);
    expect(progress.timesIncorrect).toBe(1);
    expect(progress.lastCorrect).toBe(false);
    expect(progress.repetitions).toBe(0);
  });

  it("treats flashcard AGAIN as not recalled and HARD as recalled", () => {
    expect(applyOutcome(emptyProgress(), { kind: "rated", rating: "AGAIN" }, NOW).progress.lastCorrect).toBe(false);
    expect(applyOutcome(emptyProgress(), { kind: "rated", rating: "HARD" }, NOW).progress.lastCorrect).toBe(true);
  });

  it("marks ungraded answers as seen without touching the schedule", () => {
    const start = { ...emptyProgress(), nextReviewAt: new Date(NOW.getTime() + 5 * DAY), intervalDays: 5, repetitions: 2 };
    const { progress, rating } = applyOutcome(start, { kind: "ungraded" }, NOW);
    expect(rating).toBeNull();
    expect(progress.timesSeen).toBe(1);
    expect(progress.lastSeenAt).toEqual(NOW);
    expect(progress.nextReviewAt).toEqual(start.nextReviewAt);
    expect(progress.timesCorrect + progress.timesIncorrect).toBe(0);
  });

  it("never lets timesSeen fall below graded answers (mirrors the DB CHECK constraint)", () => {
    let p = emptyProgress();
    for (const outcome of [
      { kind: "graded", correct: true },
      { kind: "ungraded" },
      { kind: "rated", rating: "AGAIN" },
      { kind: "graded", correct: false },
    ] as const) {
      p = applyOutcome(p, outcome, NOW).progress;
      expect(p.timesSeen).toBeGreaterThanOrEqual(p.timesCorrect + p.timesIncorrect);
    }
  });
});
