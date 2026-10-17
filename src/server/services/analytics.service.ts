import { prisma } from "../db";
import { visibleTo } from "./pool.service";
import { getSettings } from "./account.service";
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
import { dueForecast } from "@/lib/adaptive/review-queue";

/**
 * Dashboard numbers, all computed from persisted records. A brand-new user gets zeros and
 * nulls (rendered as empty states), never placeholder data.
 */

const DAY = 86_400_000;

export async function dashboard(userId: string) {
  const now = new Date();
  const settings = await getSettings(userId);
  const tz = settings.timeZone || "UTC";
  const yearAgo = new Date(now.getTime() - 366 * DAY);

  const [answeredTotal, graded, progressRows, flashSessions, quizzes, interviews, topics, recentQuizzes] = await Promise.all([
    prisma.questionAttempt.count({ where: { userId } }),
    prisma.questionAttempt.findMany({
      where: { userId, correct: { not: null }, createdAt: { gte: yearAgo } },
      select: { correct: true, createdAt: true, question: { select: { topicId: true } } },
    }),
    prisma.questionProgress.findMany({
      where: { userId, question: visibleTo(userId) },
      select: {
        nextReviewAt: true,
        timesSeen: true,
        timesCorrect: true,
        timesIncorrect: true,
        consecutiveCorrect: true,
        lastCorrect: true,
        lastSeenAt: true,
        question: { select: { topicId: true } },
      },
    }),
    prisma.studySession.findMany({ where: { userId, startedAt: { gte: yearAgo } }, select: { startedAt: true, lastActivityAt: true, endedAt: true } }),
    prisma.quizAttempt.findMany({ where: { userId, startedAt: { gte: yearAgo } }, select: { startedAt: true, completedAt: true } }),
    prisma.interviewSession.findMany({
      where: { userId, startedAt: { gte: yearAgo } },
      select: { startedAt: true, completedAt: true, responses: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 } },
    }),
    prisma.topic.findMany({
      where: { track: { published: true } },
      orderBy: { order: "asc" },
      select: { id: true, title: true, order: true, _count: { select: { questions: { where: { ownerId: null, published: true } } } } },
    }),
    prisma.quizAttempt.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { id: true, mode: true, score: true, correctCount: true, questionCount: true, completedAt: true },
    }),
  ]);

  const attempts = graded.map((g) => ({ topicId: g.question.topicId, correct: g.correct === true, createdAt: g.createdAt }));
  const titles = new Map(topics.map((t) => [t.id, t.title]));
  const stats = topicStats(attempts).map((s) => ({ ...s, title: titles.get(s.topicId) ?? "Unknown topic" }));
  const { weakest, strongest } = rankTopics(stats);

  // Activity days for the streak: any answer counts.
  const activity = await prisma.questionAttempt.findMany({
    where: { userId, createdAt: { gte: yearAgo } },
    select: { createdAt: true },
  });
  const streak = computeStreak(new Set(activity.map((a) => dayKey(a.createdAt, tz))), dayKey(now, tz));
  const today = dayKey(now, tz);
  const answeredToday = activity.filter((a) => dayKey(a.createdAt, tz) === today).length;

  const minutes = studyMinutes([
    ...flashSessions,
    ...quizzes.map((q) => ({ startedAt: q.startedAt, lastActivityAt: q.completedAt ?? q.startedAt, endedAt: q.completedAt })),
    ...interviews.map((i) => ({
      startedAt: i.startedAt,
      lastActivityAt: i.responses[0]?.updatedAt ?? i.startedAt,
      endedAt: i.completedAt,
    })),
  ]);

  const dueNow = progressRows.filter((p) => p.nextReviewAt && p.nextReviewAt <= now).length;

  // Recommendation signals per topic.
  const weekAgo = now.getTime() - 7 * DAY;
  const signals: TopicSignal[] = topics.map((t) => {
    const rows = progressRows.filter((p) => p.question.topicId === t.id);
    const s = stats.find((x) => x.topicId === t.id);
    return {
      topicId: t.id,
      title: t.title,
      order: t.order,
      dueCount: rows.filter((p) => p.nextReviewAt && p.nextReviewAt <= now).length,
      recentErrors: attempts.filter((a) => a.topicId === t.id && !a.correct && a.createdAt.getTime() >= weekAgo).length,
      attempts: s?.attempts ?? 0,
      correct: s?.correct ?? 0,
      unseenCount: Math.max(0, t._count.questions - rows.filter((p) => p.timesSeen > 0).length),
    };
  });

  const mastered = progressRows.filter((p) => p.consecutiveCorrect >= 3).length;
  const totalQuestions = topics.reduce((n, t) => n + t._count.questions, 0);

  return {
    isNewUser: answeredTotal === 0,
    dailyGoal: settings.dailyGoal,
    answeredToday,
    questionsAnswered: answeredTotal,
    gradedAnswers: attempts.length,
    accuracy: overallAccuracy(attempts), // null until there is graded data
    dueNow,
    studyMinutes: minutes,
    streak,
    coverage: { seen: progressRows.filter((p) => p.timesSeen > 0).length, mastered, total: totalQuestions },
    topicStats: stats.sort((a, b) => a.accuracy - b.accuracy),
    weakestTopics: weakest.map((w) => ({ ...w, title: titles.get(w.topicId) ?? "" })),
    strongestTopics: strongest.map((w) => ({ ...w, title: titles.get(w.topicId) ?? "" })),
    recentQuizzes,
    series: dailySeries(attempts, now, 30, tz),
    forecast: dueForecast(progressRows, now, 14),
    recommendation: recommendNextTopic(signals),
  };
}

export async function topicPerformance(userId: string) {
  const d = await dashboard(userId);
  return { topics: d.topicStats, weakest: d.weakestTopics, strongest: d.strongestTopics };
}

export async function studyHistory(userId: string, days: number) {
  const settings = await getSettings(userId);
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY);
  const graded = await prisma.questionAttempt.findMany({
    where: { userId, correct: { not: null }, createdAt: { gte: since } },
    select: { correct: true, createdAt: true, question: { select: { topicId: true } } },
  });
  const attempts = graded.map((g) => ({ topicId: g.question.topicId, correct: g.correct === true, createdAt: g.createdAt }));
  return { days, series: dailySeries(attempts, now, days, settings.timeZone || "UTC") };
}
