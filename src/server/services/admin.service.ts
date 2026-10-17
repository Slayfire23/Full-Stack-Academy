import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../db";
import { http } from "../http";
import { validateQuestionDraft, type QuestionDraft } from "@/lib/adaptive/question-schema";
import { wouldCreateCycle } from "@/lib/learn/prerequisites";
import { checkDuplicate, fingerprint, type Fingerprint } from "@/lib/adaptive/similarity";
import { contentHash } from "@/lib/adaptive/text";
import type {
  lessonSchema,
  lessonUpdateSchema,
  questionImportSchema,
  questionInputSchema,
  topicSchema,
  topicUpdateSchema,
  trackSchema,
  trackUpdateSchema,
} from "@/lib/validation/schemas";

/**
 * Administrator content management. Every function here is called only from routes that
 * have already passed `requireAdmin()` (server-side role check against the database).
 */

// ───────── Tracks / topics / lessons ─────────

export const tracks = {
  list: () => prisma.learningTrack.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { topics: true } } } }),
  create: (data: z.output<typeof trackSchema>) => prisma.learningTrack.create({ data }),
  update: (id: string, data: z.output<typeof trackUpdateSchema>) => prisma.learningTrack.update({ where: { id }, data }),
  remove: async (id: string) => {
    const n = await prisma.topic.count({ where: { trackId: id } });
    if (n > 0) throw http.conflict("Delete or move this track's topics first");
    await prisma.learningTrack.delete({ where: { id } });
  },
};

export const topics = {
  list: (trackId?: string) =>
    prisma.topic.findMany({
      where: trackId ? { trackId } : {},
      orderBy: [{ trackId: "asc" }, { order: "asc" }],
      include: { track: { select: { slug: true, title: true } }, _count: { select: { questions: true, lessons: true } } },
    }),
  create: async (data: z.output<typeof topicSchema>) => {
    if (!(await prisma.learningTrack.findUnique({ where: { id: data.trackId } }))) throw http.unprocessable("Unknown track");
    return prisma.topic.create({ data });
  },
  update: (id: string, data: z.output<typeof topicUpdateSchema>) => prisma.topic.update({ where: { id }, data }),
  remove: async (id: string) => {
    const n = await prisma.question.count({ where: { topicId: id } });
    if (n > 0) throw http.conflict("This topic still has questions; move or delete them first");
    await prisma.topic.delete({ where: { id } });
  },
};

export const lessons = {
  list: (topicId: string) =>
    prisma.lesson.findMany({
      where: { topicId },
      orderBy: { order: "asc" },
      include: {
        prerequisites: { select: { prerequisiteId: true, prerequisite: { select: { title: true } } } },
        questions: { where: { ownerId: null }, orderBy: { createdAt: "asc" }, select: { id: true, prompt: true, type: true } },
      },
    }),
  create: async (data: z.output<typeof lessonSchema>) => {
    if (!(await prisma.topic.findUnique({ where: { id: data.topicId } }))) throw http.unprocessable("Unknown topic");
    return prisma.lesson.create({ data });
  },
  update: (id: string, data: z.output<typeof lessonUpdateSchema>) => prisma.lesson.update({ where: { id }, data }),
  remove: (id: string) => prisma.lesson.delete({ where: { id } }),

  addPrerequisite: async (lessonId: string, prerequisiteId: string) => {
    const edges = await prisma.lessonPrerequisite.findMany({ select: { lessonId: true, prerequisiteId: true } });
    if (wouldCreateCycle(edges, { lessonId, prerequisiteId })) throw http.unprocessable("That would make a lesson its own prerequisite, directly or through a chain");
    const [a, b] = await Promise.all([
      prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } }),
      prisma.lesson.findUnique({ where: { id: prerequisiteId }, select: { id: true } }),
    ]);
    if (!a || !b) throw http.unprocessable("Unknown lesson");
    try {
      return await prisma.lessonPrerequisite.create({ data: { lessonId, prerequisiteId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw http.conflict("That prerequisite is already set");
      throw err;
    }
  },
  removePrerequisite: async (lessonId: string, prerequisiteId: string) => {
    await prisma.lessonPrerequisite.deleteMany({ where: { lessonId, prerequisiteId } });
  },
  linkQuestion: async (lessonId: string, questionId: string) => {
    if (!(await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } }))) throw http.notFound("Lesson");
    const { count } = await prisma.question.updateMany({ where: { id: questionId, ownerId: null }, data: { lessonId } });
    if (count === 0) throw http.notFound("Question");
  },
  unlinkQuestion: async (lessonId: string, questionId: string) => {
    await prisma.question.updateMany({ where: { id: questionId, lessonId }, data: { lessonId: null } });
  },
};

// ───────── Questions ─────────

type QuestionInput = z.output<typeof questionInputSchema>;

function toDraft(q: QuestionInput): QuestionDraft {
  return {
    externalKey: q.externalKey,
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt.trim(),
    answer: q.answer.trim(),
    explanation: q.explanation.trim(),
    answerData: q.answerData as QuestionDraft["answerData"],
    codeExample: q.codeExample ?? null,
    scenario: q.scenario ?? null,
    tags: q.tags.map((t) => t.trim().toLowerCase()),
  };
}

export async function listAdminQuestions(params: { topicId?: string; cursor?: string; limit: number; q?: string }) {
  const rows = await prisma.question.findMany({
    where: {
      ownerId: null,
      ...(params.topicId ? { topicId: params.topicId } : {}),
      ...(params.q ? { prompt: { contains: params.q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    include: { topic: { select: { id: true, title: true } }, _count: { select: { attempts: true } } },
  });
  const hasMore = rows.length > params.limit;
  const items = rows.slice(0, params.limit);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

async function resolveTopicId(q: QuestionInput, trackSlug: string, cache = new Map<string, string>()) {
  if (q.topicId) {
    const t = await prisma.topic.findUnique({ where: { id: q.topicId }, select: { id: true } });
    return t?.id ?? null;
  }
  if (q.topicSlug) {
    const key = `${trackSlug}/${q.topicSlug}`;
    if (cache.has(key)) return cache.get(key)!;
    const t = await prisma.topic.findFirst({ where: { slug: q.topicSlug, track: { slug: trackSlug } }, select: { id: true } });
    if (t) cache.set(key, t.id);
    return t?.id ?? null;
  }
  return null;
}

export async function createQuestion(input: QuestionInput, source: "ADMIN" | "IMPORT" = "ADMIN") {
  const topicId = await resolveTopicId(input, "backend");
  if (!topicId) throw http.unprocessable("Unknown topic", { topicId: "Provide a valid topicId or topicSlug" });
  const draft = toDraft(input);
  const report = validateQuestionDraft(draft);
  if (!report.ok) throw http.unprocessable("Question failed validation", { errors: report.errors, warnings: report.warnings });
  const bank = await prisma.question.findMany({ where: { topicId, ownerId: null }, select: { id: true, prompt: true, answer: true } });
  const dup = checkDuplicate(fingerprint(draft.prompt, draft.answer), bank.map((b) => fingerprint(b.prompt, b.answer, b.id)));
  if (dup.verdict === "duplicate") throw http.conflict("A near-identical question already exists", dup);
  const created = await prisma.question.create({ data: questionData(draft, topicId, input.published, source), select: { id: true } });
  return { id: created.id, warnings: report.warnings, similar: dup.verdict === "similar" ? dup : null };
}

function questionData(draft: QuestionDraft, topicId: string, published: boolean, source: "ADMIN" | "IMPORT") {
  return {
    externalKey: draft.externalKey ?? null,
    topicId,
    type: draft.type,
    difficulty: draft.difficulty,
    prompt: draft.prompt,
    answer: draft.answer,
    explanation: draft.explanation,
    answerData: draft.answerData as unknown as Prisma.InputJsonValue,
    codeExample: draft.codeExample ?? null,
    scenario: draft.scenario ?? null,
    tags: draft.tags,
    published,
    source,
    contentHash: contentHash(draft.prompt, draft.answer),
    dedupeScope: "global",
  };
}

export async function updateQuestion(id: string, input: QuestionInput) {
  const existing = await prisma.question.findFirst({ where: { id, ownerId: null } });
  if (!existing) throw http.notFound("Question");
  const topicId = (await resolveTopicId(input, "backend")) ?? existing.topicId;
  const draft = toDraft(input);
  const report = validateQuestionDraft(draft);
  if (!report.ok) throw http.unprocessable("Question failed validation", { errors: report.errors, warnings: report.warnings });
  const bank = await prisma.question.findMany({ where: { topicId, ownerId: null, NOT: { id } }, select: { id: true, prompt: true, answer: true } });
  const dup = checkDuplicate(fingerprint(draft.prompt, draft.answer), bank.map((b) => fingerprint(b.prompt, b.answer, b.id)));
  if (dup.verdict === "duplicate") throw http.conflict("A near-identical question already exists", dup);
  const { source: _source, externalKey: _key, ...data } = questionData(draft, topicId, input.published, "ADMIN");
  await prisma.question.update({ where: { id }, data: { ...data, externalKey: existing.externalKey ?? draft.externalKey ?? null } });
  return { id, warnings: report.warnings };
}

/** Questions with learner history are unpublished rather than deleted, so progress is not destroyed. */
export async function deleteQuestion(id: string, force: boolean) {
  const q = await prisma.question.findFirst({ where: { id, ownerId: null }, include: { _count: { select: { attempts: true } } } });
  if (!q) throw http.notFound("Question");
  if (q._count.attempts > 0 && !force) {
    await prisma.question.update({ where: { id }, data: { published: false } });
    return { id, deleted: false, unpublished: true };
  }
  await prisma.question.delete({ where: { id } });
  return { id, deleted: true, unpublished: false };
}

// ───────── JSON import ─────────

export interface ImportRowResult {
  index: number;
  externalKey?: string;
  status: "created" | "updated" | "skipped" | "invalid" | "duplicate";
  errors?: string[];
  warnings?: string[];
  nearestId?: string | null;
}

/**
 * Validates every row (schema, structure, topic, duplicates against the bank AND against
 * earlier rows in the same file), then writes all valid rows in one transaction.
 * `dryRun` returns the report without writing anything.
 */
export async function importQuestions(input: z.output<typeof questionImportSchema>) {
  const results: ImportRowResult[] = [];
  const topicCache = new Map<string, string>();
  const corpusByTopic = new Map<string, Fingerprint[]>();
  const toWrite: { index: number; draft: QuestionDraft; topicId: string; published: boolean; existingId: string | null }[] = [];

  for (const [index, row] of input.questions.entries()) {
    const draft = toDraft(row);
    const r: ImportRowResult = { index, externalKey: row.externalKey, status: "invalid" };
    const topicId = await resolveTopicId(row, input.trackSlug, topicCache);
    if (!topicId) {
      results.push({ ...r, errors: ["Unknown topic (provide topicSlug within the track, or topicId)"] });
      continue;
    }
    const report = validateQuestionDraft(draft);
    if (!report.ok) {
      results.push({ ...r, errors: report.errors, warnings: report.warnings });
      continue;
    }

    const existing = row.externalKey
      ? await prisma.question.findUnique({ where: { externalKey: row.externalKey }, select: { id: true } })
      : null;
    if (existing && input.onExisting === "skip") {
      results.push({ ...r, status: "skipped", warnings: ["externalKey already exists"] });
      continue;
    }

    if (!corpusByTopic.has(topicId)) {
      const bank = await prisma.question.findMany({ where: { topicId, ownerId: null }, select: { id: true, prompt: true, answer: true } });
      corpusByTopic.set(topicId, bank.map((b) => fingerprint(b.prompt, b.answer, b.id)));
    }
    const corpus = corpusByTopic.get(topicId)!.filter((f) => !existing || f.id !== existing.id);
    const fp = fingerprint(draft.prompt, draft.answer, `row:${index}`);
    const dup = checkDuplicate(fp, corpus);
    if (dup.verdict === "duplicate") {
      results.push({ ...r, status: "duplicate", errors: [`Duplicate of ${dup.nearestId} (similarity ${dup.score})`], nearestId: dup.nearestId });
      continue;
    }
    corpusByTopic.get(topicId)!.push(fp); // later rows in the same file are checked against this one
    toWrite.push({ index, draft, topicId, published: row.published, existingId: existing?.id ?? null });
    results.push({
      ...r,
      status: existing ? "updated" : "created",
      warnings: [...report.warnings, ...(dup.verdict === "similar" ? [`Similar to ${dup.nearestId} (${dup.score})`] : [])],
    });
  }

  if (!input.dryRun && toWrite.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const w of toWrite) {
        const data = questionData(w.draft, w.topicId, w.published, "IMPORT");
        if (w.existingId) {
          const { externalKey: _k, source: _s, ...rest } = data;
          await tx.question.update({ where: { id: w.existingId }, data: rest });
        } else {
          await tx.question.create({ data });
        }
      }
    }, { timeout: 60_000 });
  }

  const summary = results.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  return { dryRun: input.dryRun, written: input.dryRun ? 0 : toWrite.length, summary, results };
}
