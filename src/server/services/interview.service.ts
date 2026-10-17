import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../db";
import { http, HttpError } from "../http";
import { enforce, limiters } from "../limits";
import { log } from "../log";
import { loadPool, visibleTo } from "./pool.service";
import { loadHistory, loadTopicPerformance, recordOutcome } from "./progress.service";
import { getSettings } from "./account.service";
import { selectQuestions } from "@/lib/adaptive/selection";
import { randomSeed } from "@/lib/adaptive/rng";
import { rubricCoverage } from "@/lib/adaptive/grading";
import type { AnswerData } from "@/lib/adaptive/question-schema";
import { aiClientFromEnv, AiError, isAiConfigured } from "@/lib/ai/client";
import { evaluateInterviewAnswer } from "@/lib/ai/evaluation";
import type { createInterviewSchema, interviewResponseSchema } from "@/lib/validation/schemas";

/**
 * Interview practice. Works fully without AI: the learner writes an answer, reveals the model
 * answer and rubric, and self-assesses each key concept. Keyword coverage is shown as a hint,
 * clearly labelled as not a grade. With AI configured, an extra AI evaluation can be requested;
 * it is stored separately and always labelled as AI-generated.
 */

export async function createInterview(userId: string, input: z.output<typeof createInterviewSchema>) {
  let questionIds: string[];
  if (input.questionIds) {
    // Retry: these exact scenarios, provided the user can still see them.
    const rows = await prisma.question.findMany({
      where: { AND: [visibleTo(userId), { id: { in: input.questionIds }, type: "SCENARIO" }] },
      select: { id: true },
    });
    const allowed = new Set(rows.map((r) => r.id));
    questionIds = input.questionIds.filter((id) => allowed.has(id));
    if (questionIds.length === 0) throw http.unprocessable("None of those scenarios are available");
  } else {
    const topicIds = input.topicId ? [input.topicId] : [];
    let pool = await loadPool({ userId, topicIds, difficulty: input.difficulty, types: ["SCENARIO"] });
    // Few scenarios exist per topic+difficulty; widen to any difficulty rather than fail.
    if (pool.length < input.count) pool = await loadPool({ userId, topicIds, types: ["SCENARIO"] });
    if (pool.length === 0) throw http.unprocessable("No interview scenarios for this topic yet");
    const [settings, history, perf] = await Promise.all([
      getSettings(userId),
      loadHistory(prisma, userId, pool.map((q) => q.id)),
      loadTopicPerformance(prisma, userId),
    ]);
    const { picks } = selectQuestions(
      pool,
      history,
      { mode: input.mode, count: input.count, now: new Date(), seed: randomSeed(), recentWindowHours: settings.recentWindowHours },
      perf,
    );
    questionIds = picks.map((p) => p.questionId);
  }

  const session = await prisma.interviewSession.create({
    data: { userId, topicId: input.topicId ?? null, difficulty: input.difficulty, questionIds },
    select: { id: true },
  });
  return { sessionId: session.id };
}

async function ownedSession(userId: string, sessionId: string) {
  const s = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: { topic: { select: { id: true, title: true } }, responses: true },
  });
  if (!s) throw http.notFound("Interview session");
  return s;
}

export async function getInterview(userId: string, sessionId: string) {
  const s = await ownedSession(userId, sessionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: s.questionIds } },
    select: {
      id: true,
      prompt: true,
      scenario: true,
      codeExample: true,
      difficulty: true,
      explanation: true,
      answer: true,
      answerData: true,
      lessonId: true,
      topic: { select: { id: true, title: true } },
    },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const responses = new Map(s.responses.map((r) => [r.questionId, r]));
  return {
    id: s.id,
    topic: s.topic,
    difficulty: s.difficulty,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    aiConfigured: isAiConfigured(),
    questions: s.questionIds
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map((q) => {
        const r = responses.get(q.id);
        const ad = q.answerData as unknown as AnswerData;
        const base = { id: q.id, prompt: q.prompt, scenario: q.scenario, codeExample: q.codeExample, difficulty: q.difficulty, topic: q.topic, lessonId: q.lessonId };
        if (!r) return { ...base, response: null, reveal: null };
        // The model answer and rubric are revealed only after the learner has committed an answer.
        return {
          ...base,
          response: { text: r.response, rubricResult: r.rubricResult, aiFeedback: r.aiFeedback, aiModel: r.aiModel, score: r.score, updatedAt: r.updatedAt },
          reveal: {
            summary: q.answer,
            explanation: q.explanation,
            modelAnswer: ad.kind === "SCENARIO" ? ad.modelAnswer : null,
            keyConcepts: ad.kind === "SCENARIO" ? ad.keyConcepts.map((c) => ({ key: c.key, label: c.label })) : [],
          },
        };
      }),
  };
}

export async function saveResponse(userId: string, sessionId: string, input: z.output<typeof interviewResponseSchema>) {
  const s = await ownedSession(userId, sessionId);
  if (!s.questionIds.includes(input.questionId)) throw http.unprocessable("That scenario is not part of this session");
  const q = await prisma.question.findUniqueOrThrow({ where: { id: input.questionId }, select: { answerData: true } });
  const ad = q.answerData as unknown as AnswerData;
  const concepts = ad.kind === "SCENARIO" ? ad.keyConcepts : [];

  const coverage = rubricCoverage(input.response, concepts);
  const conceptKeys = new Set(concepts.map((c) => c.key));
  const selfAssessment = input.selfAssessment
    ? Object.fromEntries(Object.entries(input.selfAssessment).filter(([k]) => conceptKeys.has(k)))
    : null;
  // Score is the learner's own checklist, never presented as an objective grade.
  const score =
    selfAssessment && concepts.length > 0
      ? Math.round((Object.values(selfAssessment).filter(Boolean).length / concepts.length) * 100)
      : null;
  const rubricResult = { coverage, selfAssessment, scoreSource: score === null ? null : "self-assessment" } as unknown as Prisma.InputJsonValue;

  const isFirst = !s.responses.some((r) => r.questionId === input.questionId);
  await prisma.$transaction(async (tx) => {
    await tx.interviewResponse.upsert({
      where: { sessionId_questionId: { sessionId, questionId: input.questionId } },
      create: { sessionId, questionId: input.questionId, response: input.response, rubricResult, score },
      // Editing an answer invalidates any earlier AI feedback, which was about the old text.
      update: { response: input.response, rubricResult, score, aiFeedback: Prisma.DbNull, aiModel: null },
    });
    if (isFirst) {
      await tx.questionAttempt.create({
        data: { userId, questionId: input.questionId, kind: "INTERVIEW", submittedAnswer: { text: input.response.slice(0, 8000) }, correct: null },
      });
      await recordOutcome(tx, { userId, questionId: input.questionId, kind: "INTERVIEW", outcome: { kind: "ungraded" } });
    }
  });
  return getInterview(userId, sessionId);
}

export async function requestAiFeedback(userId: string, sessionId: string, questionId: string) {
  const client = aiClientFromEnv();
  if (!client) throw http.unavailable("AI feedback is not configured on this server. Use the model answer and rubric instead.");
  enforce(limiters.aiFeedback, userId);

  const s = await ownedSession(userId, sessionId);
  const response = s.responses.find((r) => r.questionId === questionId);
  if (!response) throw http.unprocessable("Save an answer before requesting feedback");
  const q = await prisma.question.findUniqueOrThrow({ where: { id: questionId }, select: { prompt: true, answerData: true } });
  const ad = q.answerData as unknown as AnswerData;
  if (ad.kind !== "SCENARIO") throw http.unprocessable("AI feedback is only available for scenarios");

  try {
    const evaluation = await evaluateInterviewAnswer(client, {
      prompt: q.prompt,
      modelAnswer: ad.modelAnswer,
      concepts: ad.keyConcepts,
      response: response.response,
    });
    await prisma.interviewResponse.update({
      where: { id: response.id },
      data: { aiFeedback: evaluation as unknown as Prisma.InputJsonValue, aiModel: client.model },
    });
    return { aiFeedback: evaluation, aiModel: client.model };
  } catch (err) {
    log.warn("ai_feedback_failed", { userId, sessionId, questionId, error: (err as Error).message });
    if (err instanceof AiError) throw new HttpError(502, "The AI provider could not evaluate this answer. Try again later.", "ai_error");
    throw new HttpError(502, "The AI response could not be understood. Try again.", "ai_bad_output");
  }
}

export async function completeInterview(userId: string, sessionId: string) {
  const s = await ownedSession(userId, sessionId);
  if (!s.completedAt) await prisma.interviewSession.update({ where: { id: s.id }, data: { completedAt: new Date() } });
  return { id: s.id, completed: true };
}

export async function listInterviews(userId: string, cursor: string | undefined, limit: number) {
  const rows = await prisma.interviewSession.findMany({
    where: { userId },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { topic: { select: { title: true } }, _count: { select: { responses: true } } },
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((r) => ({
    id: r.id,
    topic: r.topic?.title ?? "Mixed topics",
    difficulty: r.difficulty,
    questionCount: r.questionIds.length,
    answered: r._count.responses,
    questionIds: r.questionIds,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
  }));
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}
