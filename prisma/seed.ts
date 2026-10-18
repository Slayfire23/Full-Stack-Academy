/**
 * Idempotent seed: safe to run any number of times (`npm run db:seed`).
 *
 * - Tracks, topics and lessons are upserted by slug.
 * - Questions are upserted by `externalKey`; editing a question in content/ and re-seeding
 *   updates it in place, so user progress (keyed by question id) is preserved.
 * - Seed questions removed from content/ are unpublished, not deleted, for the same reason.
 * - An admin account is created from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD if it does not exist.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { allQuestions, curriculum, tracks } from "../content";
import { validateQuestionDraft } from "../src/lib/adaptive/question-schema";
import { contentHash } from "../src/lib/adaptive/text";

const prisma = new PrismaClient();

async function main() {
  // Refuse to seed invalid content.
  const invalid = allQuestions
    .map((q) => ({ key: q.externalKey, r: validateQuestionDraft(q) }))
    .filter((x) => !x.r.ok);
  if (invalid.length > 0) {
    for (const x of invalid) console.error(`${x.key}: ${x.r.errors.join("; ")}`);
    throw new Error(`${invalid.length} invalid seed questions — run npm run content:check`);
  }

  for (const t of tracks) {
    await prisma.learningTrack.upsert({
      where: { slug: t.slug },
      create: t,
      update: { title: t.title, description: t.description, published: t.published, order: t.order },
    });
  }
  const track = await prisma.learningTrack.findUniqueOrThrow({ where: { slug: curriculum.track.slug } });

  const topicIds = new Map<string, string>();
  const lessonIds = new Map<string, string>();
  for (const [i, t] of curriculum.topics.entries()) {
    const topic = await prisma.topic.upsert({
      where: { trackId_slug: { trackId: track.id, slug: t.slug } },
      create: { trackId: track.id, slug: t.slug, title: t.title, description: t.description, order: i + 1 },
      update: { title: t.title, description: t.description, order: i + 1 },
    });
    topicIds.set(t.slug, topic.id);
    const structured = {
      summary: t.lesson.summary ?? null,
      explanation: t.lesson.explanation ?? null,
      realWorldExample: t.lesson.realWorldExample ?? null,
      codeExample: t.lesson.codeExample ?? null,
      codeLanguage: t.lesson.codeLanguage ?? null,
      commonMistakes: t.lesson.commonMistakes ?? null,
      level: t.lesson.level ?? "BEGINNER",
      estimatedMinutes: t.lesson.estimatedMinutes ?? 10,
    };
    const lesson = await prisma.lesson.upsert({
      where: { topicId_slug: { topicId: topic.id, slug: t.lesson.slug } },
      create: { topicId: topic.id, slug: t.lesson.slug, title: t.lesson.title, content: t.lesson.content, order: 1, ...structured },
      update: { title: t.lesson.title, content: t.lesson.content, ...structured },
    });
    lessonIds.set(t.slug, lesson.id);
  }

  // Prerequisites: declared by topic slug in content/curriculum.ts, resolved to lesson ids here.
  // createMany + skipDuplicates keeps this idempotent (the composite PK already forbids repeats).
  const prereqRows: { lessonId: string; prerequisiteId: string }[] = [];
  for (const t of curriculum.topics) {
    const lessonId = lessonIds.get(t.slug);
    if (!lessonId || !t.prerequisiteSlugs) continue;
    for (const slug of t.prerequisiteSlugs) {
      const prerequisiteId = lessonIds.get(slug);
      if (prerequisiteId) prereqRows.push({ lessonId, prerequisiteId });
    }
  }
  const prereqResult =
    prereqRows.length > 0 ? await prisma.lessonPrerequisite.createMany({ data: prereqRows, skipDuplicates: true }) : { count: 0 };

  let created = 0;
  let updated = 0;
  for (const q of allQuestions) {
    const data = {
      topicId: topicIds.get(q.topic)!,
      lessonId: lessonIds.get(q.topic) ?? null,
      type: q.type,
      difficulty: q.difficulty,
      prompt: q.prompt,
      answer: q.answer,
      explanation: q.explanation,
      answerData: q.answerData as unknown as Prisma.InputJsonValue,
      codeExample: q.codeExample ?? null,
      scenario: q.scenario ?? null,
      tags: q.tags,
      published: true,
      source: "SEED" as const,
      contentHash: contentHash(q.prompt, q.answer),
      dedupeScope: "global",
    };
    const existing = await prisma.question.findUnique({ where: { externalKey: q.externalKey }, select: { id: true } });
    if (existing) {
      await prisma.question.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.question.create({ data: { ...data, externalKey: q.externalKey } });
      created++;
    }
  }

  // Unpublish seed questions that no longer exist in content/ (never delete: users may have progress on them).
  const keys = allQuestions.map((q) => q.externalKey);
  const retired = await prisma.question.updateMany({
    where: { source: "SEED", externalKey: { notIn: keys }, published: true },
    data: { published: false },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters");
    const exists = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!exists) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: "Administrator",
          role: "ADMIN",
          passwordHash: await bcrypt.hash(adminPassword, 12),
          settings: { create: {} },
        },
      });
      console.log(`Created admin ${adminEmail} — change this password after first login.`);
    } else if (exists.role !== "ADMIN") {
      await prisma.user.update({ where: { id: exists.id }, data: { role: "ADMIN" } });
      console.log(`Promoted ${adminEmail} to ADMIN.`);
    }
  }

  console.log(
    `Seed complete: ${tracks.length} tracks, ${curriculum.topics.length} topics, ` +
      `${created} questions created, ${updated} updated, ${retired.count} retired, ` +
      `${prereqResult.count} lesson prerequisites added.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
