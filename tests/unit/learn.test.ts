import { describe, it, expect } from "vitest";
import {
  emptyLessonProgress,
  viewLesson,
  completeLesson,
  recordPractice,
  LessonNotViewedError,
  InvalidUnderstandingError,
} from "@/lib/learn/progress";
import { wouldCreateCycle, computeLockStatus, orderLessons, type LessonNode, type PrereqEdge } from "@/lib/learn/prerequisites";
import { isActiveMark, resolveMarksForLesson } from "@/lib/learn/unfamiliar";
import { recommendLessons, type LessonCandidate, type RecommendationSignals } from "@/lib/learn/recommendations";

const NOW = new Date("2026-10-17T12:00:00Z");

describe("lesson progress transitions", () => {
  it("starts NOT_STARTED and moves to IN_PROGRESS on first view", () => {
    const p0 = emptyLessonProgress();
    expect(p0.status).toBe("NOT_STARTED");
    const p1 = viewLesson(p0, NOW);
    expect(p1.status).toBe("IN_PROGRESS");
    expect(p1.startedAt).toBe(NOW);
    expect(p1.lastViewedAt).toBe(NOW);
  });

  it("re-viewing updates lastViewedAt but keeps the original startedAt", () => {
    const p1 = viewLesson(emptyLessonProgress(), NOW);
    const later = new Date(NOW.getTime() + 60_000);
    const p2 = viewLesson(p1, later);
    expect(p2.status).toBe("IN_PROGRESS");
    expect(p2.startedAt).toBe(NOW);
    expect(p2.lastViewedAt).toBe(later);
  });

  it("completing requires having viewed the lesson first", () => {
    expect(() => completeLesson(emptyLessonProgress(), 4, NOW)).toThrow(LessonNotViewedError);
  });

  it("completing a viewed lesson sets status, completedAt and understanding", () => {
    const viewed = viewLesson(emptyLessonProgress(), NOW);
    const done = completeLesson(viewed, 4, NOW);
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).toBe(NOW);
    expect(done.understanding).toBe(4);
  });

  it("completing without a rating keeps any previous understanding", () => {
    const viewed = { ...viewLesson(emptyLessonProgress(), NOW), understanding: 3 };
    const done = completeLesson(viewed, undefined, NOW);
    expect(done.understanding).toBe(3);
  });

  it("rejects an understanding rating outside 1-5", () => {
    const viewed = viewLesson(emptyLessonProgress(), NOW);
    expect(() => completeLesson(viewed, 0, NOW)).toThrow(InvalidUnderstandingError);
    expect(() => completeLesson(viewed, 6, NOW)).toThrow(InvalidUnderstandingError);
  });

  it("practice answers update only practice counters", () => {
    const p1 = recordPractice(recordPractice(emptyLessonProgress(), true), false);
    expect(p1.practiceAttempts).toBe(2);
    expect(p1.practiceCorrect).toBe(1);
    expect(p1.status).toBe("NOT_STARTED");
  });
});

describe("lesson prerequisites: cycles", () => {
  it("rejects a self-reference", () => {
    expect(wouldCreateCycle([], { lessonId: "a", prerequisiteId: "a" })).toBeTruthy();
  });

  it("rejects an edge that would close a cycle", () => {
    const edges: PrereqEdge[] = [{ lessonId: "b", prerequisiteId: "a" }];
    expect(wouldCreateCycle(edges, { lessonId: "a", prerequisiteId: "b" })).toBeTruthy();
  });

  it("allows a new edge that does not create a cycle", () => {
    const edges: PrereqEdge[] = [{ lessonId: "b", prerequisiteId: "a" }];
    expect(wouldCreateCycle(edges, { lessonId: "c", prerequisiteId: "b" })).toBeFalsy();
  });
});

describe("lesson prerequisites: locking", () => {
  const lessons: LessonNode[] = [
    { id: "a", title: "A", level: "BEGINNER", order: 0 },
    { id: "b", title: "B", level: "BEGINNER", order: 1 },
  ];
  const edges: PrereqEdge[] = [{ lessonId: "b", prerequisiteId: "a" }];

  it("locks a lesson whose prerequisite is not complete", () => {
    const status = computeLockStatus(lessons, edges, new Set());
    expect(status.get("b")!.locked).toBeTruthy();
    expect(status.get("b")!.missing).toHaveLength(1);
    expect(status.get("a")!.locked).toBeFalsy();
  });

  it("unlocks once the prerequisite is completed", () => {
    const status = computeLockStatus(lessons, edges, new Set(["a"]));
    expect(status.get("b")!.locked).toBeFalsy();
  });
});

describe("lesson prerequisites: ordering", () => {
  it("orders beginner before advanced", () => {
    const lessons: LessonNode[] = [
      { id: "adv", title: "Advanced", level: "ADVANCED", order: 0 },
      { id: "beg", title: "Beginner", level: "BEGINNER", order: 0 },
    ];
    const order = orderLessons(lessons, []);
    expect(order.map((l) => l.id)).toEqual(["beg", "adv"]);
  });

  it("never places a lesson before its prerequisite, even at the same level", () => {
    const lessons: LessonNode[] = [
      { id: "b", title: "B", level: "BEGINNER", order: 0 }, // earlier `order` but depends on a
      { id: "a", title: "A", level: "BEGINNER", order: 1 },
    ];
    const edges: PrereqEdge[] = [{ lessonId: "b", prerequisiteId: "a" }];
    const order = orderLessons(lessons, edges);
    expect(order.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("does not drop lessons involved in a cycle", () => {
    const lessons: LessonNode[] = [
      { id: "a", title: "A", level: "BEGINNER", order: 0 },
      { id: "b", title: "B", level: "BEGINNER", order: 1 },
    ];
    const edges: PrereqEdge[] = [
      { lessonId: "a", prerequisiteId: "b" },
      { lessonId: "b", prerequisiteId: "a" },
    ];
    const order = orderLessons(lessons, edges);
    expect(order).toHaveLength(2);
  });
});

describe("unfamiliar marks", () => {
  it("an active mark has no resolvedAt", () => {
    expect(isActiveMark({ resolvedAt: null })).toBeTruthy();
    expect(isActiveMark({ resolvedAt: NOW })).toBeFalsy();
    expect(isActiveMark(undefined)).toBeFalsy();
  });

  it("resolves only unresolved marks linked to the completed lesson", () => {
    const marks = [
      { id: "m1", lessonId: "l1", resolvedAt: null },
      { id: "m2", lessonId: "l1", resolvedAt: NOW },
      { id: "m3", lessonId: "l2", resolvedAt: null },
      { id: "m4", lessonId: null, resolvedAt: null },
    ];
    expect(resolveMarksForLesson(marks, "l1")).toEqual(["m1"]);
  });
});

describe("lesson recommendations", () => {
  const base: LessonCandidate = {
    id: "x",
    topicId: "http",
    title: "HTTP basics",
    level: "BEGINNER",
    order: 0,
    completed: false,
    locked: false,
    missingPrerequisiteIds: [],
  };
  const noSignals: RecommendationSignals = {
    unresolvedUnfamiliarByTopic: new Map(),
    recentMissedByTopic: new Map(),
    topicAccuracy: new Map(),
    isNewUser: false,
  };

  it("recommends nothing once everything is completed", () => {
    expect(recommendLessons([{ ...base, completed: true }], noSignals)).toEqual([]);
  });

  it("falls back to a starting point for a brand-new user", () => {
    const candidates = [
      { ...base, id: "adv", level: "ADVANCED" as const, order: 0 },
      { ...base, id: "beg", level: "BEGINNER" as const, order: 0 },
    ];
    const recs = recommendLessons(candidates, { ...noSignals, isNewUser: true });
    expect(recs).toHaveLength(1);
    expect(recs[0]!.lessonId).toBe("beg");
    expect(recs[0]!.reason).toBe("A good starting point");
  });

  it("ranks by unresolved unfamiliar marks, missed questions and low accuracy", () => {
    const candidates = [
      { ...base, id: "quiet", topicId: "quiet-topic" },
      { ...base, id: "needy", topicId: "needy-topic" },
    ];
    const signals: RecommendationSignals = {
      unresolvedUnfamiliarByTopic: new Map([["needy-topic", 2]]),
      recentMissedByTopic: new Map([["needy-topic", 1]]),
      topicAccuracy: new Map([["needy-topic", 0.4]]),
      isNewUser: false,
    };
    const recs = recommendLessons(candidates, signals);
    expect(recs[0]!.lessonId).toBe("needy");
    expect(recs[0]!.reason).toContain("haven't learned this yet");
  });

  it("never recommends a locked lesson, but surfaces its missing prerequisite instead", () => {
    const candidates = [
      { ...base, id: "prereq", topicId: "http", missingPrerequisiteIds: [] },
      { ...base, id: "locked", topicId: "weak-topic", locked: true, missingPrerequisiteIds: ["prereq"] },
    ];
    const signals: RecommendationSignals = {
      unresolvedUnfamiliarByTopic: new Map([["weak-topic", 3]]),
      recentMissedByTopic: new Map(),
      topicAccuracy: new Map(),
      isNewUser: false,
    };
    const recs = recommendLessons(candidates, signals);
    expect(recs.some((r) => r.lessonId === "locked")).toBeFalsy();
    expect(recs[0]!.lessonId).toBe("prereq");
    expect(recs[0]!.reason).toContain("unlocks");
  });
});
