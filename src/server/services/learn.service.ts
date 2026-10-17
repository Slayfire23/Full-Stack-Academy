import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../db";
import { http } from "../http";
import { visibleTo } from "./pool.service";
import { recordOutcome, loadTopicPerformance } from "./progress.service";
import { gradeAnswer, publicPayload } from "@/lib/adaptive/grading";
import type { AnswerData } from "@/lib/adaptive/question-schema";
import { smoothedAccuracy } from "@/lib/adaptive/selection";
import {
  emptyLessonProgress,
  viewLesson as pureView,
  completeLesson as pureComplete,
  recordPractice as purePractice,
  LessonNotViewedError,
  InvalidUnderstandingError,
  type LessonProgressState,
} from "@/lib/learn/progress";
import { computeLockStatus, type LessonNode, type PrereqEdge } from "@/lib/learn/prerequisites";
import { resolveMarksForLesson, UNFAMILIAR_OUTCOME } from "@/lib/learn/unfamiliar";
import { recommendLessons, type LessonCandidate } from "@/lib/learn/recommendations";
import type { completeLessonSchema, lessonPracticeAnswerSchema, markUnfamiliarSchema } from "@/lib/validation/schemas";

/**
 * Learn Mode: lessons, per-user progress, prerequisites, "I haven't learned this yet",
 * and lesson recommendations. All decisions are made by src/lib/learn/*; this layer only
 * loads data, calls them, and persists the result — the same split as src/lib/adaptive.
 */

type ProgressRow = {
  status: LessonProgressState["status"];
  understanding: number | null;
  practiceAttempts: number;
  practiceCorrect: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastViewedAt: Date | null;
};

function toState(row: ProgressRow | null): LessonProgressState {
  return row ? { ...row } : emptyLessonProgress();
}

// ───────────────────────── Curriculum graph (prerequisites) ─────────────────────────

async function curriculumGraph(): Promise<{ lessons: (LessonNode & { topicId: string })[]; edges: PrereqEdge[] }> {
  const [lessons, edges] = await Promise.all([
    prisma.lesson.findMany({
      where: { published: true, topic: { track: { published: true } } },
      select: { id: true, title: true, level: true, order: true, topicId: true },
    }),
    prisma.lessonPrerequisite.findMany({ select: { lessonId: true, prerequisiteId: true } }),
  ]);
  return { lessons, edges };
}

async function completedLessonIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.lessonProgress.findMany({ where: { userId, status: "COMPLETED" }, select: { lessonId: true } });
  return new Set(rows.map((r) => r.lessonId));
}

/** Lock status for every published lesson, for this user. Used by topic pages and the lesson page. */
export async function lessonLockStatuses(userId: string) {
  const [{ lessons, edges }, completed] = await Promise.all([curriculumGraph(), completedLessonIds(userId)]);
  return { statuses: computeLockStatus(lessons, edges, completed), lessons, edges };
}

// ───────────────────────── Lesson page ─────────────────────────

const practiceQuestionSelect = {
  id: true,
  type: true,
  difficulty: true,
  prompt: true,
  scenario: true,
  codeExample: true,
  answerData: true,
} satisfies Prisma.QuestionSelect;

export async function getLesson(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, published: true, topic: { track: { published: true } } },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      summary: true,
      explanation: true,
      realWorldExample: true,
      codeExample: true,
      codeLanguage: true,
      commonMistakes: true,
      level: true,
      estimatedMinutes: true,
      order: true,
      topic: { select: { id: true, title: true, track: { select: { slug: true, title: true } } } },
    },
  });
  if (!lesson) throw http.notFound("Lesson");

  const { statuses, lessons } = await lessonLockStatuses(userId);
  const lock = statuses.get(lesson.id) ?? { locked: false, missing: [] };
  const byId = new Map(lessons.map((l) => [l.id, l]));

  const [progressRow, marks, questions] = await Promise.all([
    prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } }),
    prisma.unfamiliarMark.findMany({ where: { userId, lessonId, resolvedAt: null }, select: { questionId: true } }),
    prisma.question.findMany({ where: { lessonId, ...visibleTo(userId) }, select: practiceQuestionSelect }),
  ]);
  const unfamiliarQuestionIds = new Set(marks.map((m) => m.questionId));

  return {
    lesson: {
      ...lesson,
      locked: lock.locked,
      missingPrerequisites: lock.missing.map((m) => ({ id: m.id, title: m.title, level: m.level })),
    },
    progress: toState(progressRow),
    practiceQuestions: questions.map(({ answerData, ...q }) => ({
      ...q,
      ...publicPayload(answerData as unknown as AnswerData, []),
      markedUnfamiliar: unfamiliarQuestionIds.has(q.id),
    })),
    // For admin/debug and future "study the prerequisite" links.
    allLessonTitles: Object.fromEntries([...byId.entries()].map(([id, l]) => [id, l.title])),
  };
}

export async function viewLesson(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, published: true }, select: { id: true } });
  if (!lesson) throw http.notFound("Lesson");

  const existing = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  const next = pureView(toState(existing), new Date());
  const row = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status: next.status, startedAt: next.startedAt, lastViewedAt: next.lastViewedAt },
    update: { status: next.status, startedAt: next.startedAt, lastViewedAt: next.lastViewedAt },
  });
  return toState(row);
}

export async function completeLesson(userId: string, lessonId: string, input: z.output<typeof completeLessonSchema>) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, published: true }, select: { id: true } });
  if (!lesson) throw http.notFound("Lesson");

  const existing = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  let next: LessonProgressState;
  try {
    next = pureComplete(toState(existing), input.understanding, new Date());
  } catch (err) {
    if (err instanceof LessonNotViewedError) throw http.unprocessable("Open the lesson before marking it complete");
    if (err instanceof InvalidUnderstandingError) throw http.unprocessable("Understanding must be a whole number from 1 to 5");
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, status: next.status, understanding: next.understanding, startedAt: next.startedAt, completedAt: next.completedAt, lastViewedAt: next.lastViewedAt },
      update: { status: next.status, understanding: next.understanding, completedAt: next.completedAt },
    });

    const openMarks = await tx.unfamiliarMark.findMany({ where: { userId, lessonId, resolvedAt: null }, select: { id: true, lessonId: true, resolvedAt: true } });
    const toResolve = resolveMarksForLesson(openMarks, lessonId);
    if (toResolve.length > 0) {
      await tx.unfamiliarMark.updateMany({ where: { id: { in: toResolve } }, data: { resolvedAt: new Date() } });
    }
    return { progress: toState(row), resolvedMarks: toResolve.length };
  });
}

// ───────────────────────── Practice ─────────────────────────

export async function recordLessonPractice(userId: string, lessonId: string, input: z.output<typeof lessonPracticeAnswerSchema>) {
  const question = await prisma.question.findFirst({
    where: { id: input.questionId, lessonId, ...visibleTo(userId) },
    select: { id: true, type: true, answer: true, explanation: true, answerData: true },
  });
  if (!question) throw http.notFound("Practice question");

  const ad = question.answerData as unknown as AnswerData;
  const grade = gradeAnswer(question.type, ad, input.answer); // GradingError → 422, handled by route()

  const existing = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  const current = toState(existing);
  const next = grade.correct === null ? current : purePractice(current, grade.correct);

  await prisma.$transaction(async (tx) => {
    await tx.questionAttempt.create({
      data: {
        userId,
        questionId: input.questionId,
        kind: "LESSON_PRACTICE",
        submittedAnswer: input.answer as Prisma.InputJsonValue,
        correct: grade.correct,
        responseTimeMs: input.responseTimeMs ?? null,
      },
    });
    await recordOutcome(tx, {
      userId,
      questionId: input.questionId,
      kind: "LESSON_PRACTICE",
      outcome: grade.correct === null ? { kind: "ungraded" } : { kind: "graded", correct: grade.correct },
    });
    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, status: "IN_PROGRESS", startedAt: new Date(), lastViewedAt: new Date(), practiceAttempts: next.practiceAttempts, practiceCorrect: next.practiceCorrect },
      update: { practiceAttempts: next.practiceAttempts, practiceCorrect: next.practiceCorrect },
    });
  });

  return {
    correct: grade.correct,
    correctOptionIds: "correctOptionIds" in ad ? ad.correctOptionIds : undefined,
    acceptedAnswers: ad.kind === "SHORT_ANSWER" ? ad.acceptedAnswers : undefined,
    answer: question.answer,
    explanation: question.explanation,
    partial: grade.partial,
    progress: next,
  };
}

// ───────────────────────── "I haven't learned this yet" ─────────────────────────

export async function markUnfamiliar(userId: string, input: z.output<typeof markUnfamiliarSchema>) {
  const question = await prisma.question.findFirst({
    where: { id: input.questionId, ...visibleTo(userId) },
    select: { id: true, topicId: true, lessonId: true },
  });
  if (!question) throw http.notFound("Question");

  if (input.quizAttemptId) {
    const quiz = await prisma.quizAttempt.findFirst({ where: { id: input.quizAttemptId, userId } });
    if (!quiz) throw http.notFound("Quiz");
    if (quiz.status !== "IN_PROGRESS") throw http.conflict("This quiz is already finished");
    const slot = await prisma.quizAttemptQuestion.findUnique({
      where: { quizAttemptId_questionId: { quizAttemptId: input.quizAttemptId, questionId: input.questionId } },
    });
    if (!slot) throw http.unprocessable("That question is not part of this quiz");
    const existing = await prisma.questionAttempt.findUnique({
      where: { quizAttemptId_questionId: { quizAttemptId: input.quizAttemptId, questionId: input.questionId } },
    });
    if (existing) return { marked: true, duplicate: true, lessonId: question.lessonId };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.questionAttempt.create({
        data: {
          userId,
          questionId: input.questionId,
          quizAttemptId: input.quizAttemptId ?? null,
          kind: input.source,
          submittedAnswer: { unfamiliar: true },
          correct: null,
        },
      });
      await recordOutcome(tx, { userId, questionId: input.questionId, kind: input.source, outcome: UNFAMILIAR_OUTCOME });
      await tx.unfamiliarMark.upsert({
        where: { userId_questionId: { userId, questionId: input.questionId } },
        create: { userId, questionId: input.questionId, topicId: question.topicId, lessonId: question.lessonId, source: input.source },
        update: { resolvedAt: null, source: input.source, lessonId: question.lessonId },
      });
    });
  } catch (err) {
    // A duplicate quiz submission raced past the check above — same outcome either way.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { marked: true, duplicate: true, lessonId: question.lessonId };
    }
    throw err;
  }
  return { marked: true, duplicate: false, lessonId: question.lessonId };
}

// ───────────────────────── Recommendations ─────────────────────────

const RECENT_MISSED_DAYS = 14;

export async function getLessonRecommendations(userId: string, limit = 5) {
  const [answeredTotal, { lessons, edges }, completed, unresolvedRows, missedRows, perf] = await Promise.all([
    prisma.questionAttempt.count({ where: { userId } }),
    curriculumGraph(),
    completedLessonIds(userId),
    prisma.unfamiliarMark.groupBy({ by: ["topicId"], where: { userId, resolvedAt: null }, _count: { _all: true } }),
    prisma.questionAttempt.findMany({
      where: { userId, correct: false, createdAt: { gte: new Date(Date.now() - RECENT_MISSED_DAYS * 86_400_000) } },
      select: { question: { select: { topicId: true } } },
    }),
    loadTopicPerformance(prisma, userId),
  ]);

  const lock = computeLockStatus(lessons, edges, completed);
  const candidates: LessonCandidate[] = lessons.map((l) => {
    const status = lock.get(l.id) ?? { locked: false, missing: [] };
    return {
      id: l.id,
      topicId: l.topicId,
      title: l.title,
      level: l.level,
      order: l.order,
      completed: completed.has(l.id),
      locked: status.locked,
      missingPrerequisiteIds: status.missing.map((m) => m.id),
    };
  });

  const unresolvedUnfamiliarByTopic = new Map(unresolvedRows.map((r) => [r.topicId, r._count._all]));
  const recentMissedByTopic = new Map<string, number>();
  for (const r of missedRows) recentMissedByTopic.set(r.question.topicId, (recentMissedByTopic.get(r.question.topicId) ?? 0) + 1);
  const topicAccuracy = new Map([...perf.entries()].map(([topicId, p]) => [topicId, smoothedAccuracy(p)]));

  return recommendLessons(candidates, { unresolvedUnfamiliarByTopic, recentMissedByTopic, topicAccuracy, isNewUser: answeredTotal === 0 }, limit);
}
