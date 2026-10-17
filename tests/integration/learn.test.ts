/**
 * Integration tests for Learn Mode: real services against a real PostgreSQL test database.
 * Requires DATABASE_URL_TEST. Skipped otherwise.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  getLesson,
  viewLesson,
  completeLesson,
  recordLessonPractice,
  markUnfamiliar,
  getLessonRecommendations,
} from "@/server/services/learn.service";
import { createQuiz, submitAnswer, finishQuiz, getResults } from "@/server/services/quiz.service";
import { HttpError } from "@/server/http";
import { createUser, hasDb, questionByKey, resetDb, seedContent } from "./helpers";

describe.skipIf(!hasDb)("integration: learn mode", () => {
  let topicIds: Record<string, string>;
  let lessonIds: Record<string, string>;

  beforeEach(async () => {
    await resetDb();
    ({ topicIds, lessonIds } = await seedContent(["http", "idempotency", "concurrency"]));
  });

  it("lesson progress lifecycle: viewing starts it, completing requires a view, and the rating persists", async () => {
    const u = await createUser();
    const lessonId = lessonIds.http!;

    const before = await getLesson(u.id, lessonId);
    expect(before.progress.status).toBe("NOT_STARTED");

    await expect(completeLesson(u.id, lessonId, {})).rejects.toThrow(/open the lesson/i);

    const viewed = await viewLesson(u.id, lessonId);
    expect(viewed.status).toBe("IN_PROGRESS");
    expect(viewed.startedAt).not.toBeNull();

    const { progress } = await completeLesson(u.id, lessonId, { understanding: 4 });
    expect(progress.status).toBe("COMPLETED");
    expect(progress.understanding).toBe(4);
    expect(progress.completedAt).not.toBeNull();

    const after = await getLesson(u.id, lessonId);
    expect(after.progress.status).toBe("COMPLETED");
    expect(after.progress.understanding).toBe(4);
  });

  it("practice answers update lesson practice counters, feed the per-question schedule, and never touch quiz accuracy", async () => {
    const u = await createUser();
    const lessonId = lessonIds.http!;
    const q = await questionByKey("http-005"); // multiple choice, linked to the http lesson
    const ad = q.answerData as unknown as { correctOptionIds: string[] };

    // A real quiz, answered and finished, establishes a baseline score.
    const { quizId } = await createQuiz(u.id, { mode: "NEW", topicIds: [topicIds.http!], count: 2, feedbackMode: "IMMEDIATE" });
    for (const slot of await prisma.quizAttemptQuestion.findMany({ where: { quizAttemptId: quizId }, include: { question: true } })) {
      const sad = slot.question.answerData as unknown as { correctOptionIds?: string[]; acceptedAnswers?: string[] };
      const answer = sad.correctOptionIds ? { optionIds: sad.correctOptionIds } : { text: sad.acceptedAnswers![0]! };
      await submitAnswer(u.id, quizId, { questionId: slot.questionId, answer });
    }
    await finishQuiz(u.id, quizId);
    const quizBefore = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: quizId } });

    // Lesson practice on a question, correct this time — unrelated to the quiz above.
    const practice = await recordLessonPractice(u.id, lessonId, { questionId: q.id, answer: { optionIds: ad.correctOptionIds } });
    expect(practice.correct).toBe(true);
    expect(practice.progress.practiceAttempts).toBe(1);
    expect(practice.progress.practiceCorrect).toBe(1);

    const progressRow = await prisma.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId: u.id, lessonId } } });
    expect(progressRow.practiceAttempts).toBe(1);
    expect(progressRow.practiceCorrect).toBe(1);

    // The quiz's own stored score is untouched by practice done outside it.
    const quizAfter = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: quizId } });
    expect(quizAfter.score).toBe(quizBefore.score);
    expect(quizAfter.correctCount).toBe(quizBefore.correctCount);
    expect(quizAfter.gradedCount).toBe(quizBefore.gradedCount);

    // The answer did feed the normal per-question schedule, same as a quiz answer would.
    const schedule = await prisma.questionProgress.findUniqueOrThrow({ where: { userId_questionId: { userId: u.id, questionId: q.id } } });
    expect(schedule.timesSeen).toBeGreaterThan(0);
    expect(schedule.timesCorrect).toBeGreaterThan(0);
  });

  it("\"I haven't learned this yet\" is excluded from the quiz score denominator, not counted as wrong, and never lapses the schedule", async () => {
    const u = await createUser();
    const { quizId } = await createQuiz(u.id, { mode: "NEW", topicIds: [topicIds.http!], count: 4, feedbackMode: "IMMEDIATE" });
    const slots = await prisma.quizAttemptQuestion.findMany({ where: { quizAttemptId: quizId }, include: { question: true } });
    expect(slots.length).toBeGreaterThanOrEqual(2);

    const unfamiliarSlot = slots[0]!;
    const rest = slots.slice(1);

    const mark = await markUnfamiliar(u.id, { questionId: unfamiliarSlot.questionId, source: "QUIZ", quizAttemptId: quizId });
    expect(mark.marked).toBe(true);

    // Marking the same question unfamiliar twice (e.g. a retry) is a harmless no-op, not a crash.
    const again = await markUnfamiliar(u.id, { questionId: unfamiliarSlot.questionId, source: "QUIZ", quizAttemptId: quizId });
    expect(again.duplicate).toBe(true);

    for (const slot of rest) {
      const sad = slot.question.answerData as unknown as { correctOptionIds?: string[]; acceptedAnswers?: string[] };
      const answer = sad.correctOptionIds ? { optionIds: sad.correctOptionIds } : { text: sad.acceptedAnswers![0]! };
      await submitAnswer(u.id, quizId, { questionId: slot.questionId, answer });
    }

    const done = await finishQuiz(u.id, quizId);
    expect(done.score).toBe(100); // every graded question was answered correctly; the unfamiliar one does not drag it down

    const results = await getResults(u.id, quizId);
    const topicRow = results.topicBreakdown.find((t) => t.topicId === topicIds.http);
    expect(topicRow!.total).toBe(rest.length); // the unfamiliar slot is excluded, not counted as a miss
    expect(topicRow!.correct).toBe(rest.length);

    // Never counted as incorrect, no SRS lapse, but recorded as seen.
    const schedule = await prisma.questionProgress.findUniqueOrThrow({
      where: { userId_questionId: { userId: u.id, questionId: unfamiliarSlot.questionId } },
    });
    expect(schedule.timesIncorrect).toBe(0);
    expect(schedule.lapses).toBe(0);
    expect(schedule.timesSeen).toBeGreaterThan(0);
  });

  it("resolves \"haven't learned this yet\" marks when the linked lesson is completed", async () => {
    const u = await createUser();
    const lessonId = lessonIds.http!;
    const q = await questionByKey("http-006");

    await markUnfamiliar(u.id, { questionId: q.id, source: "FLASHCARD" });
    let mark = await prisma.unfamiliarMark.findUniqueOrThrow({ where: { userId_questionId: { userId: u.id, questionId: q.id } } });
    expect(mark.resolvedAt).toBeNull();

    await viewLesson(u.id, lessonId);
    const { resolvedMarks } = await completeLesson(u.id, lessonId, {});
    expect(resolvedMarks).toBe(1);

    mark = await prisma.unfamiliarMark.findUniqueOrThrow({ where: { userId_questionId: { userId: u.id, questionId: q.id } } });
    expect(mark.resolvedAt).not.toBeNull();
  });

  it("re-marking a question unfamiliar after it was resolved reactivates it", async () => {
    const u = await createUser();
    const lessonId = lessonIds.http!;
    const q = await questionByKey("http-006");

    await markUnfamiliar(u.id, { questionId: q.id, source: "FLASHCARD" });
    await viewLesson(u.id, lessonId);
    await completeLesson(u.id, lessonId, {});
    const resolved = await prisma.unfamiliarMark.findUniqueOrThrow({ where: { userId_questionId: { userId: u.id, questionId: q.id } } });
    expect(resolved.resolvedAt).not.toBeNull();

    const again = await markUnfamiliar(u.id, { questionId: q.id, source: "FLASHCARD" });
    expect(again.marked).toBe(true);
    const reactivated = await prisma.unfamiliarMark.findUniqueOrThrow({ where: { userId_questionId: { userId: u.id, questionId: q.id } } });
    expect(reactivated.resolvedAt).toBeNull();
    expect(reactivated.id).toBe(resolved.id); // same row, upserted — not a second mark
  });

  it("marking unfamiliar after already answering a quiz question is a no-op: no double count, verdict unchanged", async () => {
    const u = await createUser();
    const { quizId } = await createQuiz(u.id, { mode: "NEW", topicIds: [topicIds.http!], count: 2, feedbackMode: "IMMEDIATE" });
    const slot = (await prisma.quizAttemptQuestion.findMany({ where: { quizAttemptId: quizId }, include: { question: true } }))[0]!;
    const sad = slot.question.answerData as unknown as { correctOptionIds?: string[]; acceptedAnswers?: string[] };
    const wrongAnswer = sad.correctOptionIds
      ? { optionIds: [sad.correctOptionIds[0] === "a" ? "b" : "a"] }
      : { text: "definitely not the accepted answer" };

    await submitAnswer(u.id, quizId, { questionId: slot.questionId, answer: wrongAnswer });
    const attemptBefore = await prisma.questionAttempt.findUniqueOrThrow({
      where: { quizAttemptId_questionId: { quizAttemptId: quizId, questionId: slot.questionId } },
    });
    const quizBefore = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: quizId } });
    const scheduleBefore = await prisma.questionProgress.findUniqueOrThrow({
      where: { userId_questionId: { userId: u.id, questionId: slot.questionId } },
    });

    const result = await markUnfamiliar(u.id, { questionId: slot.questionId, source: "QUIZ", quizAttemptId: quizId });
    expect(result.duplicate).toBe(true);

    const attemptAfter = await prisma.questionAttempt.findUniqueOrThrow({
      where: { quizAttemptId_questionId: { quizAttemptId: quizId, questionId: slot.questionId } },
    });
    expect(attemptAfter.id).toBe(attemptBefore.id); // same row — nothing new was created
    expect(attemptAfter.correct).toBe(attemptBefore.correct); // original verdict (false) untouched

    const quizAfter = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: quizId } });
    expect(quizAfter.correctCount).toBe(quizBefore.correctCount);
    expect(quizAfter.gradedCount).toBe(quizBefore.gradedCount);

    const scheduleAfter = await prisma.questionProgress.findUniqueOrThrow({
      where: { userId_questionId: { userId: u.id, questionId: slot.questionId } },
    });
    expect(scheduleAfter.timesSeen).toBe(scheduleBefore.timesSeen);
    expect(scheduleAfter.timesIncorrect).toBe(scheduleBefore.timesIncorrect);

    // No unfamiliar mark was created — the wrong answer's verdict stands on its own.
    const mark = await prisma.unfamiliarMark.findUnique({ where: { userId_questionId: { userId: u.id, questionId: slot.questionId } } });
    expect(mark).toBeNull();
  });

  it("locks a lesson behind an unmet prerequisite, and unlocks it once the prerequisite is completed", async () => {
    const u = await createUser();
    const second = await prisma.lesson.create({
      data: { topicId: topicIds.http!, slug: "advanced", title: "HTTP: advanced", content: "x", order: 2 },
    });
    await prisma.lessonPrerequisite.create({ data: { lessonId: second.id, prerequisiteId: lessonIds.http! } });

    const locked = await getLesson(u.id, second.id);
    expect(locked.lesson.locked).toBe(true);
    expect(locked.lesson.missingPrerequisites.map((p) => p.id)).toContain(lessonIds.http);

    await viewLesson(u.id, lessonIds.http!);
    await completeLesson(u.id, lessonIds.http!, {});

    const unlocked = await getLesson(u.id, second.id);
    expect(unlocked.lesson.locked).toBe(false);
  });

  it("recommendations reflect unresolved unfamiliar marks and recently missed questions", async () => {
    const u = await createUser();
    const q = await questionByKey("http-005");
    await markUnfamiliar(u.id, { questionId: q.id, source: "FLASHCARD" });

    const recs = await getLessonRecommendations(u.id);
    const httpRec = recs.find((r) => r.lessonId === lessonIds.http);
    expect(httpRec).toBeDefined();
    expect(httpRec!.reason).toContain("haven't learned this yet");
  });

  it("ownership: a lesson that does not exist or is not published is a 404, like any other lookup", async () => {
    const u = await createUser();
    await expect(getLesson(u.id, "does-not-exist")).rejects.toThrow(HttpError);

    const unpublishedTopic = await prisma.topic.create({
      data: { trackId: (await prisma.learningTrack.findFirstOrThrow()).id, slug: "draft-topic", title: "Draft", description: "x", order: 99 },
    });
    const unpublishedLesson = await prisma.lesson.create({
      data: { topicId: unpublishedTopic.id, slug: "essentials", title: "Draft lesson", content: "x", published: false },
    });
    await expect(getLesson(u.id, unpublishedLesson.id)).rejects.toThrow(HttpError);
  });

  it("ownership: another user's private question cannot be practiced or marked unfamiliar through someone else's lesson", async () => {
    const owner = await createUser();
    const other = await createUser();
    const lessonId = lessonIds.http!;
    const privateCard = await prisma.question.create({
      data: {
        topicId: topicIds.http!,
        type: "FLASHCARD",
        difficulty: "BEGINNER",
        prompt: "Private card",
        answer: "x",
        explanation: "x",
        answerData: { kind: "FLASHCARD" },
        published: false,
        source: "USER_CUSTOM",
        ownerId: owner.id,
        dedupeScope: owner.id,
        contentHash: "private-card-hash",
      },
    });

    await expect(recordLessonPractice(other.id, lessonId, { questionId: privateCard.id, answer: { text: "x" } })).rejects.toThrow(HttpError);
    await expect(markUnfamiliar(other.id, { questionId: privateCard.id, source: "FLASHCARD" })).rejects.toThrow(HttpError);
  });
});
