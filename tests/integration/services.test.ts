/**
 * Integration tests: real services against a real PostgreSQL test database.
 * Requires DATABASE_URL_TEST (migrated with `npx prisma migrate deploy`). Skipped otherwise.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createQuiz, finishQuiz, getQuizView, getResults, retryQuiz, submitAnswer } from "@/server/services/quiz.service";
import { createCustomCard, deleteCustomCard, review, startSession, updateCustomCard, buildQueue } from "@/server/services/flashcard.service";
import { approveGenerated, ingestCannedOutput } from "@/server/services/generation.service";
import { importQuestions } from "@/server/services/admin.service";
import { dashboard } from "@/server/services/analytics.service";
import { updateSettings } from "@/server/services/account.service";
import { createInterview, getInterview, saveResponse } from "@/server/services/interview.service";
import type { AnswerData } from "@/lib/adaptive/question-schema";
import { createUser, hasDb, questionByKey, resetDb, seedContent } from "./helpers";

const OBJECTIVE = ["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "SHORT_ANSWER", "CODE_READING"] as const;

function correctAnswer(ad: AnswerData) {
  if ("correctOptionIds" in ad) return { optionIds: ad.correctOptionIds };
  if (ad.kind === "SHORT_ANSWER") return { text: ad.acceptedAnswers[0]! };
  return { text: "an answer" };
}
function wrongAnswer(ad: AnswerData) {
  if ("options" in ad) return { optionIds: [ad.options.find((o) => !ad.correctOptionIds.includes(o.id))!.id] };
  return { text: "definitely not it" };
}

describe.skipIf(!hasDb)("integration: quizzes", () => {
  let topicIds: Record<string, string>;
  beforeEach(async () => {
    await resetDb();
    ({ topicIds } = await seedContent());
  });

  it("creates a quiz whose public view contains no answer keys", async () => {
    const u = await createUser();
    const { quizId, diagnostics } = await createQuiz(u.id, { mode: "NEW", topicIds: [], count: 5, feedbackMode: "IMMEDIATE" });
    expect(diagnostics.poolSize).toBeGreaterThan(5);
    const view = await getQuizView(u.id, quizId);
    expect(view.questions).toHaveLength(5);
    const json = JSON.stringify(view);
    expect(json).not.toContain("correctOptionIds");
    expect(json).not.toContain("acceptedAnswers");
    expect(json).not.toContain("modelAnswer");
    for (const q of view.questions) expect(OBJECTIVE).toContain(q.type);
  });

  it("grades on the server, rejects duplicate submissions, and schedules a review", async () => {
    const u = await createUser();
    const { quizId } = await createQuiz(u.id, { mode: "NEW", topicIds: [topicIds.http!], count: 3, feedbackMode: "IMMEDIATE" });
    const view = await getQuizView(u.id, quizId);
    const first = view.questions[0]!;
    const ad = (await prisma.question.findUniqueOrThrow({ where: { id: first.questionId } })).answerData as unknown as AnswerData;

    const r1 = await submitAnswer(u.id, quizId, { questionId: first.questionId, answer: correctAnswer(ad) });
    expect(r1.duplicate).toBe(false);
    expect(r1.correct).toBe(true);

    const r2 = await submitAnswer(u.id, quizId, { questionId: first.questionId, answer: wrongAnswer(ad) });
    expect(r2.duplicate).toBe(true);
    expect(r2.correct).toBe(true); // the original verdict, not the replay

    const quiz = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: quizId } });
    expect(quiz.correctCount).toBe(1);
    expect(await prisma.questionAttempt.count({ where: { quizAttemptId: quizId } })).toBe(1);

    const progress = await prisma.questionProgress.findUniqueOrThrow({
      where: { userId_questionId: { userId: u.id, questionId: first.questionId } },
    });
    expect(progress.timesCorrect).toBe(1);
    expect(progress.nextReviewAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
  });

  it("handles concurrent duplicate submissions without double counting", async () => {
    const u = await createUser();
    const { quizId } = await createQuiz(u.id, { mode: "NEW", topicIds: [topicIds.http!], count: 2, feedbackMode: "IMMEDIATE" });
    const q = (await getQuizView(u.id, quizId)).questions[0]!;
    const ad = (await prisma.question.findUniqueOrThrow({ where: { id: q.questionId } })).answerData as unknown as AnswerData;
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => submitAnswer(u.id, quizId, { questionId: q.questionId, answer: correctAnswer(ad) })),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await prisma.questionAttempt.count({ where: { quizAttemptId: quizId } })).toBe(1);
    const progress = await prisma.questionProgress.findUniqueOrThrow({ where: { userId_questionId: { userId: u.id, questionId: q.questionId } } });
    expect(progress.timesSeen).toBe(1);
  });

  it("enforces ownership: another user cannot read, answer or finish the quiz", async () => {
    const a = await createUser();
    const b = await createUser();
    const { quizId } = await createQuiz(a.id, { mode: "MIXED", topicIds: [], count: 3, feedbackMode: "IMMEDIATE" });
    const q = (await getQuizView(a.id, quizId)).questions[0]!;
    await expect(getQuizView(b.id, quizId)).rejects.toMatchObject({ status: 404 });
    await expect(submitAnswer(b.id, quizId, { questionId: q.questionId, answer: { text: "x" } })).rejects.toMatchObject({ status: 404 });
    await expect(finishQuiz(b.id, quizId)).rejects.toMatchObject({ status: 404 });
  });

  it("hides results until finished in END mode, finishes idempotently, and retries missed questions", async () => {
    const u = await createUser();
    const { quizId } = await createQuiz(u.id, { mode: "NEW", topicIds: [topicIds.http!], count: 3, feedbackMode: "END" });
    const view = await getQuizView(u.id, quizId);
    const q = view.questions[0]!;
    const ad = (await prisma.question.findUniqueOrThrow({ where: { id: q.questionId } })).answerData as unknown as AnswerData;
    const r = await submitAnswer(u.id, quizId, { questionId: q.questionId, answer: wrongAnswer(ad) });
    expect(r.result).toBeNull();
    await expect(getResults(u.id, quizId)).rejects.toMatchObject({ status: 409 });

    const f1 = await finishQuiz(u.id, quizId);
    const f2 = await finishQuiz(u.id, quizId);
    expect(f1.score).toBe(0);
    expect(f2).toEqual(f1);

    const results = await getResults(u.id, quizId);
    expect(results.questions[0]!.result?.correctOptionIds ?? results.questions[0]!.result?.acceptedAnswers).toBeDefined();

    const retry = await retryQuiz(u.id, quizId, "incorrect");
    const retried = await getQuizView(u.id, retry.quizId);
    expect(retried.questions).toHaveLength(3); // 1 wrong + 2 unanswered
  });
});

describe.skipIf(!hasDb)("integration: adaptive selection with persisted history", () => {
  let topicIds: Record<string, string>;
  beforeEach(async () => {
    await resetDb();
    ({ topicIds } = await seedContent());
  });

  it("puts a previously missed question into the next Review Weak Topics quiz, for that user only", async () => {
    const a = await createUser();
    const b = await createUser();
    await updateSettings(a.id, { recentWindowHours: 0 });
    const missed = await questionByKey("http-005");
    // count is above the http topic's objective-question pool size, so every candidate
    // (including `missed`) is selected deterministically — never a random subset.
    const { quizId } = await createQuiz(a.id, { mode: "NEW", topicIds: [topicIds.http!], count: 20, feedbackMode: "IMMEDIATE" });
    await submitAnswer(a.id, quizId, { questionId: missed.id, answer: wrongAnswer(missed.answerData as unknown as AnswerData) });

    const weak = await createQuiz(a.id, { mode: "WEAK", topicIds: [topicIds.http!], count: 1, feedbackMode: "IMMEDIATE" });
    const slot = await prisma.quizAttemptQuestion.findFirstOrThrow({ where: { quizAttemptId: weak.quizId } });
    expect(slot.questionId).toBe(missed.id);
    expect(slot.selectionReason).toBe("incorrect");

    const other = await createQuiz(b.id, { mode: "WEAK", topicIds: [topicIds.http!], count: 3, feedbackMode: "IMMEDIATE" });
    const otherSlots = await prisma.quizAttemptQuestion.findMany({ where: { quizAttemptId: other.quizId } });
    expect(otherSlots.some((s) => s.selectionReason === "incorrect")).toBe(false);
  });

  it("avoids questions answered within the recency window while alternatives exist", async () => {
    const u = await createUser();
    const httpObjective = await prisma.question.findMany({ where: { topicId: topicIds.http!, type: { in: [...OBJECTIVE] } } });
    const { quizId } = await createQuiz(u.id, { mode: "NEW", topicIds: [topicIds.http!], count: httpObjective.length, feedbackMode: "IMMEDIATE" });
    for (const q of httpObjective) await submitAnswer(u.id, quizId, { questionId: q.id, answer: correctAnswer(q.answerData as unknown as AnswerData) });

    const next = await createQuiz(u.id, { mode: "MIXED", topicIds: [topicIds.http!, topicIds.concurrency!], count: 2, feedbackMode: "IMMEDIATE" });
    expect(next.diagnostics.usedRecentFallback).toBe(false);
    const slots = await prisma.quizAttemptQuestion.findMany({ where: { quizAttemptId: next.quizId } });
    expect(slots.some((s) => httpObjective.some((h) => h.id === s.questionId))).toBe(false);
  });

  it("shuffles answer order per quiz and stores it", async () => {
    const u = await createUser();
    const orders = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const { quizId } = await createQuiz(u.id, { mode: "NEW", topicIds: [topicIds.concurrency!], count: 1, types: ["MULTIPLE_SELECT"], feedbackMode: "IMMEDIATE" });
      const slot = await prisma.quizAttemptQuestion.findFirstOrThrow({ where: { quizAttemptId: quizId } });
      orders.add(slot.optionOrder.join(""));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe.skipIf(!hasDb)("integration: flashcards and custom cards", () => {
  let topicIds: Record<string, string>;
  beforeEach(async () => {
    await resetDb();
    ({ topicIds } = await seedContent());
  });

  it("records a review once per idempotency key", async () => {
    const u = await createUser();
    const q = await questionByKey("http-001");
    const first = await review(u.id, { questionId: q.id, rating: "GOOD", idempotencyKey: "review-key-1" });
    const replay = await review(u.id, { questionId: q.id, rating: "GOOD", idempotencyKey: "review-key-1" });
    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(await prisma.reviewLog.count({ where: { userId: u.id } })).toBe(1);
    expect(first.intervalDays).toBe(1);
  });

  it("resumes the unfinished session instead of creating a second one", async () => {
    const u = await createUser();
    const opts = { topicIds: [], bookmarkedOnly: false, incorrectOnly: false, includeNew: true, limit: 10, newLimit: 5 };
    const s1 = await startSession(u.id, opts);
    const s2 = await startSession(u.id, opts);
    expect(s1.resumed).toBe(false);
    expect(s2.resumed).toBe(true);
    expect(s2.id).toBe(s1.id);
  });

  it("keeps custom cards private to their owner", async () => {
    const a = await createUser();
    const b = await createUser();
    const card = await createCustomCard(a.id, {
      topicId: topicIds.http!,
      difficulty: "BEGINNER",
      prompt: "What does HTTP 418 mean in practice?",
      answer: "It is an April Fools' joke code (I'm a teapot).",
      tags: [],
    });
    await expect(updateCustomCard(b.id, card.id, { answer: "hacked" })).rejects.toMatchObject({ status: 404 });
    await expect(deleteCustomCard(b.id, card.id)).rejects.toMatchObject({ status: 404 });
    const bQueue = await buildQueue(b.id, { topicIds: [topicIds.http!], bookmarkedOnly: false, incorrectOnly: false, includeNew: true, limit: 100, newLimit: 100 });
    expect(bQueue.some((c) => c.id === card.id)).toBe(false);
    await expect(
      createCustomCard(a.id, { topicId: topicIds.http!, difficulty: "BEGINNER", prompt: "What does HTTP 418 mean in practice?", answer: "It is an April Fools' joke code (I'm a teapot).", tags: [] }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe.skipIf(!hasDb)("integration: AI generation pipeline (canned model output)", () => {
  let topicIds: Record<string, string>;
  beforeEach(async () => {
    await resetDb();
    ({ topicIds } = await seedContent());
  });

  const variation = {
    type: "MULTIPLE_CHOICE",
    difficulty: "INTERMEDIATE",
    prompt: "A refund endpoint may be called twice when a support agent double-clicks. What prevents issuing two refunds?",
    answer: "Requiring an idempotency key stored under a unique constraint and replaying the first result",
    explanation: "The second request finds the stored key and returns the original outcome instead of creating a second refund.",
    answerData: {
      kind: "MULTIPLE_CHOICE",
      options: [
        { id: "a", text: "Requiring an idempotency key stored under a unique constraint and replaying the first result" },
        { id: "b", text: "Disabling the button in the UI" },
        { id: "c", text: "Retrying the refund API on timeout" },
      ],
      correctOptionIds: ["a"],
    },
    tags: ["refunds"],
  };

  it("validates, queues, approves into the bank, and rejects a duplicate afterwards", async () => {
    const admin = await createUser("ADMIN");
    const source = await questionByKey("idem-005");
    const req = {
      kind: "VARIATION" as const,
      topicTitle: "Idempotency",
      difficulty: "INTERMEDIATE" as const,
      source: { id: source.id, type: source.type, difficulty: source.difficulty, prompt: source.prompt, answer: source.answer, explanation: source.explanation, tags: source.tags },
    };
    const queued = await ingestCannedOutput(admin.id, topicIds.idempotency!, JSON.stringify(variation), req);
    expect(queued.status).toBe("PENDING_REVIEW");
    expect(await prisma.question.count({ where: { source: "AI_GENERATED" } })).toBe(0); // not served before approval

    const approved = await approveGenerated(admin.id, queued.id);
    expect(approved.status).toBe("APPROVED");
    const q = await prisma.question.findUniqueOrThrow({ where: { id: approved.publishedQuestionId! } });
    expect(q.source).toBe("AI_GENERATED");
    expect(q.tags).toContain("ai-generated");
    expect(q.parentQuestionId).toBe(source.id);

    const again = await ingestCannedOutput(admin.id, topicIds.idempotency!, JSON.stringify(variation), req);
    expect(again.status).toBe("REJECTED");
  });

  it("stores unparseable output as rejected without touching the bank", async () => {
    const admin = await createUser("ADMIN");
    const before = await prisma.question.count();
    const r = await ingestCannedOutput(admin.id, topicIds.idempotency!, "I cannot help with that.", {
      kind: "INTERVIEW_SCENARIO",
      topicTitle: "Idempotency",
      difficulty: "ADVANCED",
    });
    expect(r.status).toBe("REJECTED");
    expect(await prisma.question.count()).toBe(before);
  });
});

describe.skipIf(!hasDb)("integration: imports, interviews and analytics", () => {
  beforeEach(async () => {
    await resetDb();
    await seedContent();
  });

  it("dry-runs an import without writing, flags duplicates, then imports valid rows", async () => {
    const http001 = await questionByKey("http-001");
    const fresh = {
      externalKey: "http-900",
      topicSlug: "http",
      type: "SHORT_ANSWER" as const,
      difficulty: "BEGINNER" as const,
      prompt: "Which status code means a resource was moved permanently?",
      answer: "301 Moved Permanently",
      explanation: "301 tells clients and crawlers to use the new URL from now on; 308 is the method-preserving variant.",
      answerData: { kind: "SHORT_ANSWER", acceptedAnswers: ["301"] },
      tags: ["http"],
      published: true,
    };
    const dup = { ...fresh, externalKey: undefined, type: "FLASHCARD" as const, prompt: http001.prompt, answer: http001.answer, explanation: http001.explanation, answerData: { kind: "FLASHCARD" } };
    const dry = await importQuestions({ trackSlug: "backend", dryRun: true, onExisting: "skip", questions: [fresh, dup] });
    expect(dry.summary).toEqual({ created: 1, duplicate: 1 });
    expect(await prisma.question.count({ where: { externalKey: "http-900" } })).toBe(0);
    const real = await importQuestions({ trackSlug: "backend", dryRun: false, onExisting: "skip", questions: [fresh, dup] });
    expect(real.written).toBe(1);
    expect(await prisma.question.count({ where: { externalKey: "http-900", source: "IMPORT" } })).toBe(1);
  });

  it("reveals the model answer only after a response is saved", async () => {
    const u = await createUser();
    const { sessionId } = await createInterview(u.id, { difficulty: "INTERMEDIATE", mode: "NEW", count: 1 });
    const before = await getInterview(u.id, sessionId);
    expect(before.questions[0]!.reveal).toBeNull();
    const after = await saveResponse(u.id, sessionId, { questionId: before.questions[0]!.id, response: "Use an idempotency key with a unique constraint." });
    expect(after.questions[0]!.reveal?.modelAnswer).toBeTruthy();
    await expect(getInterview((await createUser()).id, sessionId)).rejects.toMatchObject({ status: 404 });
  });

  it("reports empty analytics for a new user and real numbers after studying", async () => {
    const u = await createUser();
    const empty = await dashboard(u.id);
    expect(empty.isNewUser).toBe(true);
    expect(empty.accuracy).toBeNull();
    expect(empty.streak.current).toBe(0);
    expect(empty.recommendation?.basis).toBe("starting-point");

    await review(u.id, { questionId: (await questionByKey("http-001")).id, rating: "AGAIN" });
    const after = await dashboard(u.id);
    expect(after.isNewUser).toBe(false);
    expect(after.questionsAnswered).toBe(1);
    expect(after.accuracy).toBe(0);
    expect(after.streak.current).toBe(1);
  });
});
