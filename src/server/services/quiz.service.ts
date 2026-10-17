import { Prisma, type QuestionType } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../db";
import { http } from "../http";
import { loadPool } from "./pool.service";
import { loadHistory, loadTopicPerformance, recordOutcome } from "./progress.service";
import { getSettings } from "./account.service";
import { composeQuiz, shuffleOptions } from "@/lib/adaptive/selection";
import { createRng, randomSeed, shuffle } from "@/lib/adaptive/rng";
import { gradeAnswer, publicPayload, type GradeResult } from "@/lib/adaptive/grading";
import type { AnswerData } from "@/lib/adaptive/question-schema";
import type { createQuizSchema, submitAnswerSchema } from "@/lib/validation/schemas";

const OBJECTIVE: QuestionType[] = ["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "SHORT_ANSWER", "CODE_READING"];
const GRACE_MS = 5_000; // network latency allowance for timed quizzes

type CreateQuizInput = z.output<typeof createQuizSchema>;
type SubmitInput = z.output<typeof submitAnswerSchema>;

// ───────────────────────── Create ─────────────────────────

export async function createQuiz(userId: string, input: CreateQuizInput) {
  const settings = await getSettings(userId);
  const types = (input.types as QuestionType[] | undefined) ?? OBJECTIVE;
  const pool = await loadPool({ userId, topicIds: input.topicIds, difficulty: input.difficulty, types });
  if (pool.length === 0) throw http.unprocessable("No questions match these filters — try more topics or another difficulty");

  const [history, topicPerf] = await Promise.all([
    loadHistory(prisma, userId, pool.map((q) => q.id)),
    loadTopicPerformance(prisma, userId),
  ]);
  const seed = randomSeed();
  const now = new Date();
  const { slots, diagnostics } = composeQuiz(
    pool,
    history,
    { mode: input.mode, count: input.count, now, seed, recentWindowHours: settings.recentWindowHours },
    topicPerf,
  );

  const quiz = await prisma.quizAttempt.create({
    data: {
      userId,
      mode: input.mode,
      feedbackMode: input.feedbackMode,
      timeLimitSeconds: input.timeLimitSeconds ?? null,
      expiresAt: input.timeLimitSeconds ? new Date(now.getTime() + input.timeLimitSeconds * 1000) : null,
      seed,
      topicIds: input.topicIds,
      difficulty: input.difficulty ?? null,
      questionCount: slots.length,
      questions: {
        create: slots.map((s) => ({
          questionId: s.questionId,
          position: s.position,
          optionOrder: s.optionOrder,
          selectionReason: s.reason,
        })),
      },
    },
    select: { id: true },
  });
  return { quizId: quiz.id, diagnostics };
}

// ───────────────────────── Read ─────────────────────────

async function loadOwnedQuiz(userId: string, quizId: string) {
  // Ownership is part of the query: another user's quiz id is indistinguishable from a missing one.
  const quiz = await prisma.quizAttempt.findFirst({
    where: { id: quizId, userId },
    include: {
      questions: {
        orderBy: { position: "asc" },
        include: {
          question: {
            select: {
              id: true,
              type: true,
              difficulty: true,
              prompt: true,
              answer: true,
              explanation: true,
              answerData: true,
              codeExample: true,
              scenario: true,
              tags: true,
              lessonId: true,
              topic: { select: { id: true, title: true } },
            },
          },
        },
      },
      attempts: { select: { questionId: true, submittedAnswer: true, correct: true, feedback: true, createdAt: true } },
    },
  });
  if (!quiz) throw http.notFound("Quiz");
  return quiz;
}

type LoadedQuiz = Awaited<ReturnType<typeof loadOwnedQuiz>>;

/** Auto-complete timed quizzes whose clock has run out. */
async function expireIfNeeded(quiz: LoadedQuiz) {
  if (quiz.status === "IN_PROGRESS" && quiz.expiresAt && Date.now() > quiz.expiresAt.getTime() + GRACE_MS) {
    await finishQuiz(quiz.userId, quiz.id);
    return loadOwnedQuiz(quiz.userId, quiz.id);
  }
  return quiz;
}

function reveal(slot: LoadedQuiz["questions"][number], attempt: LoadedQuiz["attempts"][number] | undefined) {
  const q = slot.question;
  const ad = q.answerData as unknown as AnswerData;
  const result: GradeResult | null =
    attempt && attempt.submittedAnswer
      ? safeGrade(q.type, ad, attempt.submittedAnswer as unknown as Parameters<typeof gradeAnswer>[2])
      : null;
  return {
    correct: attempt?.correct ?? null,
    correctOptionIds: "correctOptionIds" in ad ? ad.correctOptionIds : undefined,
    acceptedAnswers: ad.kind === "SHORT_ANSWER" ? ad.acceptedAnswers : undefined,
    modelAnswer: ad.kind === "SCENARIO" ? ad.modelAnswer : undefined,
    keyConcepts: ad.kind === "SCENARIO" ? ad.keyConcepts.map((c) => ({ key: c.key, label: c.label })) : undefined,
    rubric: result?.rubric,
    partial: result?.partial,
    answer: q.answer,
    explanation: q.explanation,
  };
}

function safeGrade(type: QuestionType, ad: AnswerData, submitted: Parameters<typeof gradeAnswer>[2]) {
  try {
    return gradeAnswer(type, ad, submitted);
  } catch {
    return null; // question edited after the attempt; keep the stored verdict
  }
}

/**
 * Quiz as the learner sees it. Answer keys are included only for questions already answered
 * in IMMEDIATE-feedback mode, or for every question once the quiz is completed.
 */
export async function getQuizView(userId: string, quizId: string) {
  const quiz = await expireIfNeeded(await loadOwnedQuiz(userId, quizId));
  const attempts = new Map(quiz.attempts.map((a) => [a.questionId, a]));
  const completed = quiz.status !== "IN_PROGRESS";

  return {
    id: quiz.id,
    mode: quiz.mode,
    status: quiz.status,
    feedbackMode: quiz.feedbackMode,
    startedAt: quiz.startedAt,
    expiresAt: quiz.expiresAt,
    completedAt: quiz.completedAt,
    remainingSeconds: quiz.expiresAt && !completed ? Math.max(0, Math.floor((quiz.expiresAt.getTime() - Date.now()) / 1000)) : null,
    score: quiz.score,
    correctCount: quiz.correctCount,
    gradedCount: quiz.gradedCount,
    questionCount: quiz.questionCount,
    questions: quiz.questions.map((slot) => {
      const attempt = attempts.get(slot.questionId);
      const showResult = completed || (attempt && quiz.feedbackMode === "IMMEDIATE");
      const q = slot.question;
      return {
        questionId: q.id,
        position: slot.position,
        selectionReason: slot.selectionReason,
        type: q.type,
        difficulty: q.difficulty,
        topic: q.topic,
        prompt: q.prompt,
        codeExample: q.codeExample,
        scenario: q.scenario,
        tags: q.tags,
        lessonId: q.lessonId,
        ...publicPayload(q.answerData as unknown as AnswerData, slot.optionOrder),
        submitted: attempt ? attempt.submittedAnswer : null,
        result: showResult ? reveal(slot, attempt) : null,
      };
    }),
  };
}

// ───────────────────────── Answer ─────────────────────────

export async function submitAnswer(userId: string, quizId: string, input: SubmitInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const quiz = await tx.quizAttempt.findFirst({ where: { id: quizId, userId } });
      if (!quiz) throw http.notFound("Quiz");
      if (quiz.status !== "IN_PROGRESS") throw http.conflict("This quiz is already finished");
      if (quiz.expiresAt && Date.now() > quiz.expiresAt.getTime() + GRACE_MS) throw http.conflict("Time is up for this quiz");

      const slot = await tx.quizAttemptQuestion.findUnique({
        where: { quizAttemptId_questionId: { quizAttemptId: quizId, questionId: input.questionId } },
        include: { question: { select: { id: true, type: true, answerData: true, explanation: true, answer: true } } },
      });
      if (!slot) throw http.unprocessable("That question is not part of this quiz");

      const existing = await tx.questionAttempt.findUnique({
        where: { quizAttemptId_questionId: { quizAttemptId: quizId, questionId: input.questionId } },
      });
      if (existing) return { duplicate: true as const, ...(await answerResponse(quiz.feedbackMode, slot, existing.correct, existing.submittedAnswer)) };

      const ad = slot.question.answerData as unknown as AnswerData;
      const grade = gradeAnswer(slot.question.type, ad, input.answer); // GradingError → 422

      await tx.questionAttempt.create({
        data: {
          userId,
          questionId: input.questionId,
          quizAttemptId: quizId,
          kind: "QUIZ",
          submittedAnswer: input.answer as Prisma.InputJsonValue,
          correct: grade.correct,
          responseTimeMs: input.responseTimeMs ?? null,
        },
      });
      if (grade.correct !== null) {
        await tx.quizAttempt.update({
          where: { id: quizId },
          data: { gradedCount: { increment: 1 }, correctCount: { increment: grade.correct ? 1 : 0 } },
        });
      }
      await recordOutcome(tx, {
        userId,
        questionId: input.questionId,
        kind: "QUIZ",
        outcome: grade.correct === null ? { kind: "ungraded" } : { kind: "graded", correct: grade.correct },
      });
      return { duplicate: false as const, ...(await answerResponse(quiz.feedbackMode, slot, grade.correct, input.answer, grade)) };
    });
  } catch (err) {
    // Two identical submissions raced past the existence check: the unique index caught the second one.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.questionAttempt.findUnique({
        where: { quizAttemptId_questionId: { quizAttemptId: quizId, questionId: input.questionId } },
      });
      if (existing && existing.userId === userId) {
        return { duplicate: true as const, recorded: true, correct: null, result: null };
      }
    }
    throw err;
  }
}

async function answerResponse(
  feedbackMode: "IMMEDIATE" | "END",
  slot: { question: { type: QuestionType; answerData: unknown; explanation: string; answer: string } },
  correct: boolean | null,
  submitted: unknown,
  grade?: GradeResult,
) {
  if (feedbackMode === "END") return { recorded: true, correct: null, result: null };
  const ad = slot.question.answerData as AnswerData;
  const g = grade ?? safeGrade(slot.question.type, ad, submitted as Parameters<typeof gradeAnswer>[2]);
  return {
    recorded: true,
    correct,
    result: {
      correct,
      correctOptionIds: "correctOptionIds" in ad ? ad.correctOptionIds : undefined,
      acceptedAnswers: ad.kind === "SHORT_ANSWER" ? ad.acceptedAnswers : undefined,
      modelAnswer: ad.kind === "SCENARIO" ? ad.modelAnswer : undefined,
      keyConcepts: ad.kind === "SCENARIO" ? ad.keyConcepts.map((c) => ({ key: c.key, label: c.label })) : undefined,
      rubric: g?.rubric,
      partial: g?.partial,
      answer: slot.question.answer,
      explanation: slot.question.explanation,
    },
  };
}

// ───────────────────────── Finish / results ─────────────────────────

/** Idempotent: finishing a finished quiz returns the stored result. */
export async function finishQuiz(userId: string, quizId: string) {
  return prisma.$transaction(async (tx) => {
    // Lock the quiz row so two finish calls (or a finish racing a timer expiry) do not both score it.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "QuizAttempt" WHERE "id" = ${quizId} AND "userId" = ${userId} FOR UPDATE`;
    if (locked.length === 0) throw http.notFound("Quiz");
    const quiz = await tx.quizAttempt.findUniqueOrThrow({
      where: { id: quizId },
      include: {
        questions: { select: { questionId: true, question: { select: { type: true } } } },
        attempts: { select: { questionId: true, correct: true } },
      },
    });
    if (quiz.status !== "IN_PROGRESS") return { id: quiz.id, status: quiz.status, score: quiz.score };

    const correctByQuestion = new Map(quiz.attempts.map((a) => [a.questionId, a.correct]));
    // Unanswered objective questions count as incorrect; open-ended ones never affect the score.
    // A question answered but explicitly ungraded (correct === null — "I haven't learned this
    // yet", or any other ungraded outcome) is excluded from the denominator entirely, since it
    // was never objectively judged at all — it is neither right nor wrong.
    const objectiveTotal = quiz.questions.filter(
      (s) => OBJECTIVE.includes(s.question.type) && correctByQuestion.get(s.questionId) !== null,
    ).length;
    const score = objectiveTotal > 0 ? Math.round((quiz.correctCount / objectiveTotal) * 1000) / 10 : null;
    const done = await tx.quizAttempt.update({
      where: { id: quizId },
      data: { status: "COMPLETED", completedAt: new Date(), score },
      select: { id: true, status: true, score: true },
    });
    return done;
  });
}

export async function getResults(userId: string, quizId: string) {
  const view = await getQuizView(userId, quizId);
  if (view.status === "IN_PROGRESS") throw http.conflict("Finish the quiz to see full results");
  const byTopic = new Map<string, { topicId: string; title: string; total: number; correct: number }>();
  for (const q of view.questions) {
    if (!OBJECTIVE.includes(q.type as QuestionType)) continue;
    // Answered but explicitly ungraded (e.g. "I haven't learned this yet") — excluded entirely,
    // not counted as wrong. An unanswered question (submitted === null) still counts as incorrect.
    if (q.submitted !== null && q.result?.correct === null) continue;
    const t = byTopic.get(q.topic.id) ?? { topicId: q.topic.id, title: q.topic.title, total: 0, correct: 0 };
    t.total++;
    if (q.result?.correct) t.correct++;
    byTopic.set(q.topic.id, t);
  }
  return { ...view, topicBreakdown: [...byTopic.values()] };
}

export async function listQuizzes(userId: string, cursor: string | undefined, limit: number) {
  const rows = await prisma.quizAttempt.findMany({
    where: { userId },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      mode: true,
      status: true,
      score: true,
      questionCount: true,
      correctCount: true,
      gradedCount: true,
      feedbackMode: true,
      timeLimitSeconds: true,
      startedAt: true,
      completedAt: true,
    },
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

/** New quiz with the same questions (all, or only those missed / skipped), freshly shuffled. */
export async function retryQuiz(userId: string, quizId: string, scope: "incorrect" | "all") {
  const quiz = await loadOwnedQuiz(userId, quizId);
  if (quiz.status === "IN_PROGRESS") throw http.conflict("Finish this quiz before retrying it");
  const attempts = new Map(quiz.attempts.map((a) => [a.questionId, a]));
  const chosen = quiz.questions.filter((s) => {
    if (scope === "all") return true;
    const a = attempts.get(s.questionId);
    return !a || a.correct === false;
  });
  if (chosen.length === 0) throw http.unprocessable("Nothing to retry — you answered everything correctly");

  const seed = randomSeed();
  const rng = createRng(seed);
  const ordered = shuffle(chosen, rng);
  const created = await prisma.quizAttempt.create({
    data: {
      userId,
      mode: quiz.mode,
      feedbackMode: quiz.feedbackMode,
      timeLimitSeconds: quiz.timeLimitSeconds,
      expiresAt: quiz.timeLimitSeconds ? new Date(Date.now() + quiz.timeLimitSeconds * 1000) : null,
      seed,
      topicIds: quiz.topicIds,
      difficulty: quiz.difficulty,
      questionCount: ordered.length,
      questions: {
        create: ordered.map((s, position) => ({
          questionId: s.questionId,
          position,
          optionOrder: shuffleOptions(
            "options" in (s.question.answerData as object)
              ? (s.question.answerData as { options: { id: string }[] }).options.map((o) => o.id)
              : [],
            rng,
          ),
          selectionReason: scope === "incorrect" ? "incorrect" : "retry",
        })),
      },
    },
    select: { id: true },
  });
  return { quizId: created.id };
}
