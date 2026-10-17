import type { Prisma, PrismaClient, StudyKind } from "@prisma/client";
import { applyOutcome, type AnswerOutcome, type ProgressRecord, type Rating } from "@/lib/adaptive/srs";
import type { TopicPerformance } from "@/lib/adaptive/selection";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Per-user question state. Every answer anywhere in the app (flashcard rating, quiz answer,
 * interview response) goes through `recordOutcome`, so history and the review schedule stay
 * consistent across study modes. Rows are keyed by (userId, questionId): one user's history
 * never influences another's.
 */

interface ProgressRow {
  id: string;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
  timesSeen: number;
  timesCorrect: number;
  timesIncorrect: number;
  consecutiveCorrect: number;
  lastCorrect: boolean | null;
  lastRating: Rating | null;
  lastSeenAt: Date | null;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
}

function toRecord(row: ProgressRow): ProgressRecord {
  return {
    repetitions: row.repetitions,
    intervalDays: Number(row.intervalDays),
    easeFactor: Number(row.easeFactor),
    lapses: row.lapses,
    timesSeen: row.timesSeen,
    timesCorrect: row.timesCorrect,
    timesIncorrect: row.timesIncorrect,
    consecutiveCorrect: row.consecutiveCorrect,
    lastCorrect: row.lastCorrect,
    lastRating: row.lastRating,
    lastSeenAt: row.lastSeenAt,
    lastReviewedAt: row.lastReviewedAt,
    nextReviewAt: row.nextReviewAt,
  };
}

/** History for the selector: only this user's rows, optionally limited to some questions. */
export async function loadHistory(db: Db, userId: string, questionIds?: string[]): Promise<Map<string, ProgressRecord>> {
  const rows = await db.questionProgress.findMany({
    where: { userId, ...(questionIds ? { questionId: { in: questionIds } } : {}) },
  });
  return new Map(rows.map((r) => [r.questionId, toRecord(r as unknown as ProgressRow)]));
}

/** Topic accuracy across everything the user has answered (not just the current pool). */
export async function loadTopicPerformance(db: Db, userId: string): Promise<Map<string, TopicPerformance>> {
  const rows = await db.questionProgress.findMany({
    where: { userId },
    select: { timesCorrect: true, timesIncorrect: true, question: { select: { topicId: true } } },
  });
  const perf = new Map<string, TopicPerformance>();
  for (const r of rows) {
    const graded = r.timesCorrect + r.timesIncorrect;
    if (graded === 0) continue;
    const p = perf.get(r.question.topicId) ?? { attempts: 0, correct: 0 };
    p.attempts += graded;
    p.correct += r.timesCorrect;
    perf.set(r.question.topicId, p);
  }
  return perf;
}

export interface RecordOutcomeInput {
  userId: string;
  questionId: string;
  outcome: AnswerOutcome;
  kind: StudyKind;
  now?: Date;
  idempotencyKey?: string;
}

/**
 * Apply one answer to the user's progress row. Must run inside a transaction:
 *  1. make sure the row exists (INSERT ... ON CONFLICT DO NOTHING — safe under concurrency),
 *  2. lock it with SELECT ... FOR UPDATE so concurrent answers to the same question serialise,
 *  3. compute the new state with the pure scheduler and write it back,
 *  4. append a ReviewLog entry when the schedule changed (unique idempotency key per user).
 */
export async function recordOutcome(tx: Prisma.TransactionClient, input: RecordOutcomeInput) {
  const now = input.now ?? new Date();
  await tx.$executeRaw`
    INSERT INTO "QuestionProgress" ("id", "userId", "questionId", "updatedAt")
    VALUES (gen_random_uuid()::text, ${input.userId}, ${input.questionId}, now())
    ON CONFLICT ("userId", "questionId") DO NOTHING`;
  const rows = await tx.$queryRaw<ProgressRow[]>`
    SELECT "id", "repetitions", "intervalDays", "easeFactor", "lapses", "timesSeen", "timesCorrect",
           "timesIncorrect", "consecutiveCorrect", "lastCorrect", "lastRating"::text AS "lastRating",
           "lastSeenAt", "lastReviewedAt", "nextReviewAt"
    FROM "QuestionProgress"
    WHERE "userId" = ${input.userId} AND "questionId" = ${input.questionId}
    FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new Error("progress row missing after upsert");

  const before = toRecord(row);
  const { progress, rating } = applyOutcome(before, input.outcome, now);

  await tx.questionProgress.update({
    where: { id: row.id },
    data: {
      repetitions: progress.repetitions,
      intervalDays: progress.intervalDays,
      easeFactor: progress.easeFactor,
      lapses: progress.lapses,
      timesSeen: progress.timesSeen,
      timesCorrect: progress.timesCorrect,
      timesIncorrect: progress.timesIncorrect,
      consecutiveCorrect: progress.consecutiveCorrect,
      lastCorrect: progress.lastCorrect,
      lastRating: progress.lastRating,
      lastSeenAt: progress.lastSeenAt,
      lastReviewedAt: progress.lastReviewedAt,
      nextReviewAt: progress.nextReviewAt,
    },
  });

  if (rating) {
    await tx.reviewLog.create({
      data: {
        userId: input.userId,
        questionId: input.questionId,
        rating,
        kind: input.kind,
        prevIntervalDays: before.intervalDays,
        newIntervalDays: progress.intervalDays,
        prevEaseFactor: before.easeFactor,
        newEaseFactor: progress.easeFactor,
        idempotencyKey: input.idempotencyKey ?? null,
        reviewedAt: now,
      },
    });
  }
  return { before, progress, rating };
}
