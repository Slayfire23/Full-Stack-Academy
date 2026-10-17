/**
 * Lesson progress transitions. Pure: no database, no clock access (time is a parameter).
 * Tracked separately from quiz/flashcard accuracy — practice answers here never touch
 * QuestionProgress or any quiz score.
 */

export type LessonStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface LessonProgressState {
  status: LessonStatus;
  understanding: number | null;
  practiceAttempts: number;
  practiceCorrect: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastViewedAt: Date | null;
}

export function emptyLessonProgress(): LessonProgressState {
  return {
    status: "NOT_STARTED",
    understanding: null,
    practiceAttempts: 0,
    practiceCorrect: 0,
    startedAt: null,
    completedAt: null,
    lastViewedAt: null,
  };
}

/** Viewing a lesson starts it (NOT_STARTED → IN_PROGRESS) and always bumps lastViewedAt. */
export function viewLesson(p: LessonProgressState, now: Date): LessonProgressState {
  return {
    ...p,
    status: p.status === "NOT_STARTED" ? "IN_PROGRESS" : p.status,
    startedAt: p.startedAt ?? now,
    lastViewedAt: now,
  };
}

export class LessonNotViewedError extends Error {}
export class InvalidUnderstandingError extends Error {}

/** Completing requires having viewed the lesson first. Understanding, if given, must be 1-5. */
export function completeLesson(
  p: LessonProgressState,
  understanding: number | null | undefined,
  now: Date,
): LessonProgressState {
  if (p.status === "NOT_STARTED") throw new LessonNotViewedError("View the lesson before marking it complete");
  if (understanding != null && (understanding < 1 || understanding > 5 || !Number.isInteger(understanding))) {
    throw new InvalidUnderstandingError("Understanding must be a whole number from 1 to 5");
  }
  return {
    ...p,
    status: "COMPLETED",
    completedAt: now,
    understanding: understanding ?? p.understanding,
  };
}

/** A practice answer updates only the lesson's own practice counters — never quiz accuracy. */
export function recordPractice(p: LessonProgressState, correct: boolean): LessonProgressState {
  return {
    ...p,
    practiceAttempts: p.practiceAttempts + 1,
    practiceCorrect: p.practiceCorrect + (correct ? 1 : 0),
  };
}
