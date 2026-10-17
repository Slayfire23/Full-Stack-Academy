import { Prisma, type Difficulty } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../db";
import { http } from "../http";
import { poolWhere, visibleTo } from "./pool.service";
import { loadHistory, recordOutcome } from "./progress.service";
import { buildReviewQueue } from "@/lib/adaptive/review-queue";
import { randomSeed } from "@/lib/adaptive/rng";
import { validateQuestionDraft, type QuestionDraft } from "@/lib/adaptive/question-schema";
import { contentHash } from "@/lib/adaptive/text";
import { checkDuplicate, fingerprint } from "@/lib/adaptive/similarity";
import type {
  customFlashcardSchema,
  customFlashcardUpdateSchema,
  flashcardSessionSchema,
  reviewSchema,
} from "@/lib/validation/schemas";

/**
 * Flashcards use every visible question: the front is the prompt, the back is the canonical
 * answer plus explanation. Ratings feed the same per-user schedule as quizzes.
 */

export interface QueueFilter {
  topicIds: string[];
  difficulty?: Difficulty;
  bookmarkedOnly: boolean;
  incorrectOnly: boolean;
  includeNew: boolean;
  limit: number;
  newLimit: number;
}

const cardSelect = {
  id: true,
  type: true,
  difficulty: true,
  prompt: true,
  answer: true,
  explanation: true,
  codeExample: true,
  scenario: true,
  tags: true,
  source: true,
  ownerId: true,
  topic: { select: { id: true, title: true } },
} satisfies Prisma.QuestionSelect;

async function cardsFor(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const [rows, history, bookmarks] = await Promise.all([
    prisma.question.findMany({ where: { AND: [visibleTo(userId), { id: { in: ids } }] }, select: cardSelect }),
    loadHistory(prisma, userId, ids),
    prisma.bookmark.findMany({ where: { userId, questionId: { in: ids } }, select: { questionId: true } }),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const marked = new Set(bookmarks.map((b) => b.questionId));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => {
      const h = history.get(r.id);
      return {
        ...r,
        isCustom: r.ownerId === userId,
        bookmarked: marked.has(r.id),
        progress: h
          ? { nextReviewAt: h.nextReviewAt, timesSeen: h.timesSeen, lastCorrect: h.lastCorrect, consecutiveCorrect: h.consecutiveCorrect }
          : null,
      };
    });
}

export async function buildQueue(userId: string, f: QueueFilter) {
  const pool = await prisma.question.findMany({
    where: poolWhere({ userId, topicIds: f.topicIds, difficulty: f.difficulty, bookmarkedOnly: f.bookmarkedOnly }),
    select: { id: true, topicId: true },
  });
  const history = await loadHistory(prisma, userId, pool.map((q) => q.id));
  const now = new Date();

  let ids: string[];
  if (f.incorrectOnly) {
    // "Review incorrect answers": everything the user last got wrong, most recently missed first.
    ids = pool
      .filter((q) => history.get(q.id)?.lastCorrect === false)
      .sort((a, b) => (history.get(b.id)?.lastSeenAt?.getTime() ?? 0) - (history.get(a.id)?.lastSeenAt?.getTime() ?? 0))
      .slice(0, f.limit)
      .map((q) => q.id);
  } else {
    ids = buildReviewQueue(pool, history, {
      now,
      seed: randomSeed(),
      limit: f.limit,
      newLimit: f.newLimit,
      includeNew: f.includeNew,
    }).map((i) => i.questionId);
  }
  return cardsFor(userId, ids);
}

export async function dueSummary(userId: string) {
  const now = new Date();
  const [due, upcoming] = await Promise.all([
    prisma.questionProgress.count({ where: { userId, nextReviewAt: { lte: now }, question: visibleTo(userId) } }),
    prisma.questionProgress.count({
      where: { userId, nextReviewAt: { gt: now, lte: new Date(now.getTime() + 86_400_000) }, question: visibleTo(userId) },
    }),
  ]);
  return { due, dueWithin24h: upcoming };
}

// ───────────────────────── Sessions (resume) ─────────────────────────

interface SessionState {
  questionIds: string[];
  index: number;
  reviewed: string[];
  filters: QueueFilter;
}

const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;

export async function getActiveSession(userId: string) {
  const s = await prisma.studySession.findFirst({
    where: { userId, kind: "FLASHCARD", endedAt: null, lastActivityAt: { gte: new Date(Date.now() - RESUME_WINDOW_MS) } },
    orderBy: { lastActivityAt: "desc" },
  });
  if (!s) return null;
  const state = s.state as unknown as SessionState;
  if (!state || state.index >= state.questionIds.length) return null;
  return { id: s.id, state, cards: await cardsFor(userId, state.questionIds) };
}

export async function startSession(userId: string, input: z.output<typeof flashcardSessionSchema>) {
  const active = await getActiveSession(userId);
  if (active) return { ...active, resumed: true };

  const filters: QueueFilter = {
    topicIds: input.topicIds,
    difficulty: input.difficulty,
    bookmarkedOnly: input.bookmarkedOnly,
    incorrectOnly: input.incorrectOnly,
    includeNew: input.includeNew,
    limit: input.limit,
    newLimit: input.newLimit,
  };
  const cards = await buildQueue(userId, filters);
  if (cards.length === 0) return { id: null, state: null, cards: [], resumed: false };
  const state: SessionState = { questionIds: cards.map((c) => c.id), index: 0, reviewed: [], filters };
  const s = await prisma.studySession.create({
    data: { userId, kind: "FLASHCARD", state: state as unknown as Prisma.InputJsonValue },
  });
  return { id: s.id, state, cards, resumed: false };
}

export async function updateSession(userId: string, sessionId: string, patch: { index?: number; end?: boolean }) {
  const s = await prisma.studySession.findFirst({ where: { id: sessionId, userId, kind: "FLASHCARD" } });
  if (!s) throw http.notFound("Study session");
  const state = s.state as unknown as SessionState;
  const index = patch.index !== undefined ? Math.min(patch.index, state.questionIds.length) : state.index;
  await prisma.studySession.update({
    where: { id: s.id },
    data: {
      state: { ...state, index } as unknown as Prisma.InputJsonValue,
      lastActivityAt: new Date(),
      endedAt: patch.end || index >= state.questionIds.length ? new Date() : null,
    },
  });
  return { id: s.id, index, ended: Boolean(patch.end || index >= state.questionIds.length) };
}

// ───────────────────────── Reviews ─────────────────────────

export async function review(userId: string, input: z.output<typeof reviewSchema>) {
  const question = await prisma.question.findFirst({ where: { AND: [visibleTo(userId), { id: input.questionId }] }, select: { id: true } });
  if (!question) throw http.notFound("Question");

  if (input.idempotencyKey) {
    const replay = await prisma.reviewLog.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    });
    if (replay) return currentSchedule(userId, input.questionId, true);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await recordOutcome(tx, {
        userId,
        questionId: input.questionId,
        kind: "FLASHCARD",
        outcome: { kind: "rated", rating: input.rating },
        idempotencyKey: input.idempotencyKey,
      });
      await tx.questionAttempt.create({
        data: {
          userId,
          questionId: input.questionId,
          kind: "FLASHCARD",
          submittedAnswer: { rating: input.rating },
          correct: input.rating !== "AGAIN",
          responseTimeMs: input.responseTimeMs ?? null,
        },
      });
      if (input.sessionId) {
        const s = await tx.studySession.findFirst({ where: { id: input.sessionId, userId, kind: "FLASHCARD" } });
        if (s) {
          const state = s.state as unknown as SessionState;
          const pos = state.questionIds.indexOf(input.questionId);
          const reviewed = state.reviewed.includes(input.questionId) ? state.reviewed : [...state.reviewed, input.questionId];
          const index = Math.max(state.index, pos + 1);
          await tx.studySession.update({
            where: { id: s.id },
            data: {
              state: { ...state, reviewed, index } as unknown as Prisma.InputJsonValue,
              lastActivityAt: new Date(),
              endedAt: index >= state.questionIds.length ? new Date() : null,
            },
          });
        }
      }
    });
  } catch (err) {
    // A concurrent replay with the same idempotency key lost the race on the unique index.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && input.idempotencyKey) {
      return currentSchedule(userId, input.questionId, true);
    }
    throw err;
  }
  return currentSchedule(userId, input.questionId, false);
}

async function currentSchedule(userId: string, questionId: string, duplicate: boolean) {
  const p = await prisma.questionProgress.findUnique({ where: { userId_questionId: { userId, questionId } } });
  return {
    duplicate,
    questionId,
    nextReviewAt: p?.nextReviewAt ?? null,
    intervalDays: p?.intervalDays ?? 0,
    easeFactor: p?.easeFactor ?? 2.5,
    repetitions: p?.repetitions ?? 0,
  };
}

export async function reviewHistory(userId: string, cursor: string | undefined, limit: number) {
  const rows = await prisma.reviewLog.findMany({
    where: { userId },
    orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      rating: true,
      kind: true,
      reviewedAt: true,
      prevIntervalDays: true,
      newIntervalDays: true,
      question: { select: { id: true, prompt: true, topic: { select: { title: true } } } },
    },
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

// ───────────────────────── Custom flashcards ─────────────────────────

const DEFAULT_EXPLANATION = "Your own flashcard. Edit it to add an explanation of why the answer is right.";

function customDraft(input: { difficulty: Difficulty; prompt: string; answer: string; explanation?: string; codeExample?: string; tags: string[] }): QuestionDraft {
  return {
    type: "FLASHCARD",
    difficulty: input.difficulty,
    prompt: input.prompt,
    answer: input.answer,
    explanation: input.explanation && input.explanation.length >= 30 ? input.explanation : (input.explanation ? `${input.explanation} — ` : "") + DEFAULT_EXPLANATION,
    answerData: { kind: "FLASHCARD" },
    codeExample: input.codeExample ?? null,
    tags: [...new Set(["custom", ...input.tags])],
  };
}

export async function createCustomCard(userId: string, input: z.output<typeof customFlashcardSchema>) {
  const topic = await prisma.topic.findUnique({ where: { id: input.topicId }, select: { id: true } });
  if (!topic) throw http.unprocessable("Unknown topic", { topicId: "Unknown topic" });
  const draft = customDraft(input);
  const report = validateQuestionDraft(draft);
  if (!report.ok) throw http.unprocessable("This flashcard is not valid", { errors: report.errors });

  // Near-duplicates of the shared bank are allowed (the card is private) but reported back.
  const similar = await prisma.question.findMany({
    where: { topicId: input.topicId, OR: [{ ownerId: null, published: true }, { ownerId: userId }] },
    select: { id: true, prompt: true, answer: true },
  });
  const dup = checkDuplicate(fingerprint(draft.prompt, draft.answer), similar.map((s) => fingerprint(s.prompt, s.answer, s.id)));

  try {
    const card = await prisma.question.create({
      data: {
        topicId: input.topicId,
        type: "FLASHCARD",
        difficulty: draft.difficulty,
        prompt: draft.prompt,
        answer: draft.answer,
        explanation: draft.explanation,
        answerData: draft.answerData as Prisma.InputJsonValue,
        codeExample: draft.codeExample,
        tags: draft.tags,
        published: false,
        source: "USER_CUSTOM",
        ownerId: userId,
        dedupeScope: userId,
        contentHash: contentHash(draft.prompt, draft.answer),
      },
      select: { id: true },
    });
    return { id: card.id, similarTo: dup.verdict !== "unique" ? { questionId: dup.nearestId, score: dup.score } : null };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw http.conflict("You already have a flashcard with this question and answer");
    }
    throw err;
  }
}

export async function updateCustomCard(userId: string, id: string, input: z.output<typeof customFlashcardUpdateSchema>) {
  const card = await prisma.question.findFirst({ where: { id, ownerId: userId } });
  if (!card) throw http.notFound("Flashcard"); // also what other users see — no existence leak
  if (input.topicId) {
    const topic = await prisma.topic.findUnique({ where: { id: input.topicId }, select: { id: true } });
    if (!topic) throw http.unprocessable("Unknown topic");
  }
  const draft = customDraft({
    difficulty: input.difficulty ?? card.difficulty,
    prompt: input.prompt ?? card.prompt,
    answer: input.answer ?? card.answer,
    explanation: input.explanation ?? card.explanation,
    codeExample: input.codeExample ?? card.codeExample ?? undefined,
    tags: input.tags ?? card.tags.filter((t) => t !== "custom"),
  });
  const report = validateQuestionDraft(draft);
  if (!report.ok) throw http.unprocessable("This flashcard is not valid", { errors: report.errors });
  try {
    await prisma.question.update({
      where: { id },
      data: {
        topicId: input.topicId ?? card.topicId,
        difficulty: draft.difficulty,
        prompt: draft.prompt,
        answer: draft.answer,
        explanation: draft.explanation,
        codeExample: draft.codeExample,
        tags: draft.tags,
        contentHash: contentHash(draft.prompt, draft.answer),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw http.conflict("You already have a flashcard with this question and answer");
    }
    throw err;
  }
  return { id };
}

export async function deleteCustomCard(userId: string, id: string) {
  const { count } = await prisma.question.deleteMany({ where: { id, ownerId: userId } });
  if (count === 0) throw http.notFound("Flashcard");
}

export async function listCustomCards(userId: string) {
  return prisma.question.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: cardSelect,
  });
}

// ───────────────────────── Bookmarks ─────────────────────────

export async function addBookmark(userId: string, questionId: string) {
  const q = await prisma.question.findFirst({ where: { AND: [visibleTo(userId), { id: questionId }] }, select: { id: true } });
  if (!q) throw http.notFound("Question");
  await prisma.bookmark.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId },
    update: {},
  });
  return { bookmarked: true };
}

export async function removeBookmark(userId: string, questionId: string) {
  await prisma.bookmark.deleteMany({ where: { userId, questionId } });
  return { bookmarked: false };
}

export async function listBookmarks(userId: string) {
  const rows = await prisma.bookmark.findMany({
    where: { userId, question: visibleTo(userId) },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, question: { select: cardSelect } },
  });
  return rows.map((r) => ({ ...r.question, bookmarkedAt: r.createdAt }));
}
