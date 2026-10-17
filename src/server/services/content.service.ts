import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../db";
import { http } from "../http";
import { visibleTo } from "./pool.service";
import { publicPayload } from "@/lib/adaptive/grading";
import type { AnswerData } from "@/lib/adaptive/question-schema";
import type { questionListQuerySchema } from "@/lib/validation/schemas";

/** Read-only curriculum browsing: tracks → topics → lessons → questions (without answer keys). */

export async function listTracks() {
  const tracks = await prisma.learningTrack.findMany({
    orderBy: { order: "asc" },
    select: { id: true, slug: true, title: true, description: true, published: true, _count: { select: { topics: true } } },
  });
  return tracks.map((t) => ({ ...t, comingSoon: !t.published, topicCount: t._count.topics }));
}

export async function getTrack(userId: string, slug: string) {
  const track = await prisma.learningTrack.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      published: true,
      topics: {
        orderBy: { order: "asc" },
        select: { id: true, slug: true, title: true, description: true, order: true },
      },
    },
  });
  if (!track) throw http.notFound("Track");
  if (!track.published) return { ...track, topics: [], comingSoon: true };

  const topicIds = track.topics.map((t) => t.id);
  const [counts, progress] = await Promise.all([
    prisma.question.groupBy({
      by: ["topicId", "difficulty"],
      where: { topicId: { in: topicIds }, ownerId: null, published: true },
      _count: { _all: true },
    }),
    prisma.questionProgress.findMany({
      where: { userId, question: { topicId: { in: topicIds }, ownerId: null } },
      select: { timesSeen: true, consecutiveCorrect: true, question: { select: { topicId: true } } },
    }),
  ]);

  return {
    ...track,
    comingSoon: false,
    topics: track.topics.map((t) => {
      const c = counts.filter((x) => x.topicId === t.id);
      const total = c.reduce((n, x) => n + x._count._all, 0);
      const mine = progress.filter((p) => p.question.topicId === t.id);
      return {
        ...t,
        questionCount: total,
        byDifficulty: Object.fromEntries(c.map((x) => [x.difficulty, x._count._all])),
        seen: mine.filter((p) => p.timesSeen > 0).length,
        mastered: mine.filter((p) => p.consecutiveCorrect >= 3).length,
      };
    }),
  };
}

export async function getTopic(userId: string, topicId: string) {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, track: { published: true } },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      track: { select: { slug: true, title: true } },
      lessons: { orderBy: { order: "asc" }, select: { id: true, slug: true, title: true, content: true, order: true } },
    },
  });
  if (!topic) throw http.notFound("Topic");
  const counts = await prisma.question.groupBy({
    by: ["type"],
    where: { AND: [visibleTo(userId), { topicId }] },
    _count: { _all: true },
  });
  return { ...topic, questionTypes: Object.fromEntries(counts.map((c) => [c.type, c._count._all])) };
}

export async function listTopics(trackSlug = "backend") {
  return prisma.topic.findMany({
    where: { track: { slug: trackSlug, published: true } },
    orderBy: { order: "asc" },
    select: { id: true, slug: true, title: true, description: true, order: true },
  });
}

/** Paginated question browsing. Never includes answer keys, model answers or accepted answers. */
export async function listQuestions(userId: string, query: z.output<typeof questionListQuerySchema>) {
  const where: Prisma.QuestionWhereInput = {
    AND: [
      visibleTo(userId),
      query.topicId ? { topicId: query.topicId } : {},
      query.difficulty ? { difficulty: query.difficulty } : {},
      query.type ? { type: query.type } : {},
      query.q ? { prompt: { contains: query.q, mode: "insensitive" } } : {},
    ],
  };
  const rows = await prisma.question.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      difficulty: true,
      prompt: true,
      codeExample: true,
      scenario: true,
      tags: true,
      source: true,
      answerData: true,
      topic: { select: { id: true, title: true } },
    },
  });
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit).map(({ answerData, ...q }) => ({
    ...q,
    ...publicPayload(answerData as unknown as AnswerData, []),
  }));
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}
