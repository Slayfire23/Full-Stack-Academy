import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { contentHash } from "@/lib/adaptive/text";
import { allQuestions, curriculum } from "../../content";

export const hasDb = Boolean(process.env.DATABASE_URL_TEST);

/** Empty every table (fast, respects FKs via CASCADE). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
}

/** Minimal curriculum: the backend track, a few topics, their lesson and seed questions. */
export async function seedContent(topicSlugs = ["http", "idempotency", "concurrency"]) {
  const track = await prisma.learningTrack.create({
    data: { slug: "backend", title: "Backend Development", description: "x", published: true, order: 1 },
  });
  const topicIds: Record<string, string> = {};
  const lessonIds: Record<string, string> = {};
  for (const [i, slug] of topicSlugs.entries()) {
    const t = curriculum.topics.find((x) => x.slug === slug)!;
    const topic = await prisma.topic.create({ data: { trackId: track.id, slug, title: t.title, description: t.description, order: i } });
    topicIds[slug] = topic.id;
    const lesson = await prisma.lesson.create({
      data: {
        topicId: topic.id,
        slug: t.lesson.slug,
        title: t.lesson.title,
        content: t.lesson.content,
        summary: t.lesson.summary ?? null,
        explanation: t.lesson.explanation ?? null,
        realWorldExample: t.lesson.realWorldExample ?? null,
        codeExample: t.lesson.codeExample ?? null,
        codeLanguage: t.lesson.codeLanguage ?? null,
        commonMistakes: t.lesson.commonMistakes ?? null,
        level: t.lesson.level ?? "BEGINNER",
        estimatedMinutes: t.lesson.estimatedMinutes ?? 10,
      },
    });
    lessonIds[slug] = lesson.id;
  }
  for (const q of allQuestions.filter((x) => topicSlugs.includes(x.topic))) {
    await prisma.question.create({
      data: {
        externalKey: q.externalKey,
        topicId: topicIds[q.topic]!,
        lessonId: lessonIds[q.topic] ?? null,
        type: q.type,
        difficulty: q.difficulty,
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.explanation,
        answerData: q.answerData as unknown as Prisma.InputJsonValue,
        codeExample: q.codeExample ?? null,
        tags: q.tags,
        contentHash: contentHash(q.prompt, q.answer),
      },
    });
  }
  return { trackId: track.id, topicIds, lessonIds };
}

let n = 0;
export async function createUser(role: "USER" | "ADMIN" = "USER") {
  n++;
  return prisma.user.create({
    data: { name: `User ${n}`, email: `user${n}-${Date.now()}@example.com`, passwordHash: "x", role, settings: { create: {} } },
  });
}

export async function questionByKey(key: string) {
  return prisma.question.findUniqueOrThrow({ where: { externalKey: key } });
}
