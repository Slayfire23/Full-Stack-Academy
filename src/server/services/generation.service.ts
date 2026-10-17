import { Prisma, type Difficulty } from "@prisma/client";
import { prisma } from "../db";
import { http, HttpError } from "../http";
import { log } from "../log";
import { aiClientFromEnv, AiError, isAiConfigured } from "@/lib/ai/client";
import { evaluateGeneratedText, generateQuestion, type GenerationOutcome, type GenerationRequest } from "@/lib/ai/generation";
import { validateQuestionDraft, type QuestionDraft } from "@/lib/adaptive/question-schema";
import { checkDuplicate, fingerprint, type Fingerprint } from "@/lib/adaptive/similarity";
import { contentHash } from "@/lib/adaptive/text";

/**
 * AI-generated questions: request → validate → dedupe → queue → (approve) → permanent bank.
 *
 * Nothing generated is served to learners until it is APPROVED, which happens either through
 * an admin decision or automatically when AI_AUTO_PUBLISH=true and every automated check passed.
 * Approval re-runs validation and the duplicate check against the bank *as it is then*, because
 * other questions may have been added since the draft was created.
 */

export function generationStatus() {
  return {
    aiConfigured: isAiConfigured(),
    autoPublish: process.env.AI_AUTO_PUBLISH === "true",
    hourlyLimit: hourlyLimit(),
  };
}

function hourlyLimit() {
  const n = Number(process.env.AI_GENERATION_HOURLY_LIMIT ?? 20);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
}

/** Exact across all app instances, because it counts persisted rows. */
async function enforceQuota(userId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const used = await prisma.generatedQuestion.count({ where: { requestedById: userId, createdAt: { gte: since } } });
  if (used >= hourlyLimit()) throw http.tooMany(15 * 60);
}

/** Fingerprints of every question in the topic, plus drafts still awaiting review. */
async function topicCorpus(topicId: string): Promise<{ corpus: Fingerprint[]; prompts: string[] }> {
  const [questions, pending] = await Promise.all([
    prisma.question.findMany({ where: { topicId, ownerId: null }, select: { id: true, prompt: true, answer: true } }),
    prisma.generatedQuestion.findMany({ where: { topicId, status: "PENDING_REVIEW" }, select: { id: true, payload: true } }),
  ]);
  const corpus = questions.map((q) => fingerprint(q.prompt, q.answer, q.id));
  for (const p of pending) {
    const d = p.payload as unknown as QuestionDraft | null;
    if (d?.prompt && d?.answer) corpus.push(fingerprint(d.prompt, d.answer, `pending:${p.id}`));
  }
  return { corpus, prompts: questions.map((q) => q.prompt) };
}

export async function requestGeneration(
  userId: string,
  input: { kind: "VARIATION"; questionId: string } | { kind: "INTERVIEW_SCENARIO"; topicId: string; difficulty: Difficulty },
) {
  const client = aiClientFromEnv();
  if (!client) throw http.unavailable("AI generation is not configured on this server. All study features work without it.");
  await enforceQuota(userId);

  let req: GenerationRequest;
  let topicId: string;
  let sourceQuestionId: string | null = null;

  if (input.kind === "VARIATION") {
    const source = await prisma.question.findFirst({
      where: { id: input.questionId, ownerId: null, published: true },
      include: { topic: { select: { id: true, title: true } } },
    });
    if (!source) throw http.notFound("Question");
    topicId = source.topicId;
    sourceQuestionId = source.id;
    const { corpus, prompts } = await topicCorpus(topicId);
    req = {
      kind: "VARIATION",
      topicTitle: source.topic.title,
      difficulty: source.difficulty,
      source: {
        id: source.id,
        type: source.type,
        difficulty: source.difficulty,
        prompt: source.prompt,
        answer: source.answer,
        explanation: source.explanation,
        codeExample: source.codeExample,
        tags: source.tags,
      },
      corpus: corpus.filter((f) => f.id !== source.id),
      avoidPrompts: prompts,
    };
  } else {
    const topic = await prisma.topic.findUnique({ where: { id: input.topicId }, select: { id: true, title: true } });
    if (!topic) throw http.notFound("Topic");
    topicId = topic.id;
    const { corpus, prompts } = await topicCorpus(topicId);
    req = { kind: "INTERVIEW_SCENARIO", topicTitle: topic.title, difficulty: input.difficulty, corpus, avoidPrompts: prompts };
  }

  let outcome: GenerationOutcome;
  try {
    outcome = await generateQuestion(client, req);
  } catch (err) {
    log.warn("ai_generation_failed", { userId, kind: input.kind, error: (err as Error).message });
    if (err instanceof AiError) throw new HttpError(502, "The AI provider did not respond successfully. Try again later.", "ai_error");
    throw err;
  }

  const record = await storeOutcome({ userId, topicId, sourceQuestionId, kind: input.kind, model: client.model, outcome });
  return record;
}

/** Shared by live generation and tests that feed canned model output. */
export async function storeOutcome(args: {
  userId: string | null;
  topicId: string;
  sourceQuestionId: string | null;
  kind: "VARIATION" | "INTERVIEW_SCENARIO";
  model: string;
  outcome: GenerationOutcome;
}) {
  const { outcome } = args;
  const draft = outcome.draft;
  const autoPublish = process.env.AI_AUTO_PUBLISH === "true";
  const created = await prisma.generatedQuestion.create({
    data: {
      kind: args.kind,
      status: outcome.accepted ? "PENDING_REVIEW" : "REJECTED",
      topicId: args.topicId,
      sourceQuestionId: args.sourceQuestionId,
      requestedById: args.userId,
      model: args.model,
      payload: (draft ?? { rawExcerpt: outcome.rawExcerpt }) as unknown as Prisma.InputJsonValue,
      validationReport: { ...outcome.validation, duplicate: outcome.duplicate } as unknown as Prisma.InputJsonValue,
      contentHash: draft ? contentHash(draft.prompt, draft.answer) : "invalid",
      similarityScore: outcome.duplicate?.score ?? null,
      nearestQuestionId: outcome.duplicate?.nearestId?.startsWith("pending:") ? null : (outcome.duplicate?.nearestId ?? null),
      rejectionReason: outcome.accepted ? null : outcome.validation.errors.join(" ").slice(0, 1000),
    },
  });

  if (outcome.accepted && autoPublish) {
    try {
      return await approveGenerated(null, created.id);
    } catch (err) {
      log.warn("auto_publish_failed", { id: created.id, error: (err as Error).message });
    }
  }
  return summarize(created);
}

function summarize(g: { id: string; status: string; kind: string; payload: unknown; validationReport: unknown; rejectionReason: string | null; similarityScore: number | null; publishedQuestionId: string | null }) {
  return {
    id: g.id,
    status: g.status,
    kind: g.kind,
    draft: g.payload,
    validation: g.validationReport,
    rejectionReason: g.rejectionReason,
    similarityScore: g.similarityScore,
    publishedQuestionId: g.publishedQuestionId,
    aiGenerated: true,
  };
}

export async function listGenerated(status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | undefined, cursor: string | undefined, limit: number) {
  const rows = await prisma.generatedQuestion.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      topic: { select: { title: true } },
      sourceQuestion: { select: { id: true, prompt: true } },
      requestedBy: { select: { name: true, email: true } },
    },
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((g) => ({
    ...summarize(g),
    topic: g.topic.title,
    sourceQuestion: g.sourceQuestion,
    requestedBy: g.requestedBy,
    model: g.model,
    createdAt: g.createdAt,
    reviewedAt: g.reviewedAt,
  }));
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

/** Promote a validated draft into the permanent bank. `reviewerId` null = automatic approval. */
export async function approveGenerated(reviewerId: string | null, id: string) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "GeneratedQuestion" WHERE "id" = ${id} FOR UPDATE`;
    if (locked.length === 0) throw http.notFound("Generated question");
    const g = await tx.generatedQuestion.findUniqueOrThrow({ where: { id } });
    if (g.status === "APPROVED") return summarize(g);
    if (g.status === "REJECTED" && !g.payload) throw http.conflict("This draft cannot be approved");

    const draft = g.payload as unknown as QuestionDraft;
    const report = validateQuestionDraft(draft);
    if (!report.ok) throw http.unprocessable("Draft no longer passes validation", { errors: report.errors });

    const bank = await tx.question.findMany({ where: { topicId: g.topicId, ownerId: null }, select: { id: true, prompt: true, answer: true } });
    const dup = checkDuplicate(fingerprint(draft.prompt, draft.answer), bank.map((q) => fingerprint(q.prompt, q.answer, q.id)));
    if (dup.verdict === "duplicate") {
      await tx.generatedQuestion.update({
        where: { id },
        data: { status: "REJECTED", rejectionReason: `Duplicate of ${dup.nearestId} at approval time (${dup.score})`, reviewedById: reviewerId, reviewedAt: new Date() },
      });
      throw http.conflict("An equivalent question is already in the bank", { nearestQuestionId: dup.nearestId, score: dup.score });
    }

    const lesson = await tx.lesson.findFirst({ where: { topicId: g.topicId }, orderBy: { order: "asc" }, select: { id: true } });
    const question = await tx.question.create({
      data: {
        topicId: g.topicId,
        lessonId: lesson?.id ?? null,
        type: draft.type,
        difficulty: draft.difficulty,
        prompt: draft.prompt,
        answer: draft.answer,
        explanation: draft.explanation,
        answerData: draft.answerData as unknown as Prisma.InputJsonValue,
        codeExample: draft.codeExample ?? null,
        scenario: draft.scenario ?? null,
        tags: [...new Set(["ai-generated", ...draft.tags])],
        published: true,
        source: "AI_GENERATED",
        parentQuestionId: g.sourceQuestionId,
        contentHash: contentHash(draft.prompt, draft.answer),
        dedupeScope: "global",
      },
      select: { id: true },
    });
    const updated = await tx.generatedQuestion.update({
      where: { id },
      data: { status: "APPROVED", publishedQuestionId: question.id, reviewedById: reviewerId, reviewedAt: new Date(), rejectionReason: null },
    });
    return summarize(updated);
  });
}

export async function rejectGenerated(reviewerId: string, id: string, reason: string) {
  const g = await prisma.generatedQuestion.findUnique({ where: { id } });
  if (!g) throw http.notFound("Generated question");
  if (g.status === "APPROVED") throw http.conflict("Already approved — unpublish the question instead");
  const updated = await prisma.generatedQuestion.update({
    where: { id },
    data: { status: "REJECTED", rejectionReason: reason, reviewedById: reviewerId, reviewedAt: new Date() },
  });
  return summarize(updated);
}

/** Exposed for tests: run the post-model pipeline on canned output and store it. */
export async function ingestCannedOutput(userId: string, topicId: string, raw: string, req: Omit<GenerationRequest, "corpus">) {
  const { corpus } = await topicCorpus(topicId);
  const outcome = evaluateGeneratedText(raw, { ...req, corpus } as GenerationRequest);
  return storeOutcome({ userId, topicId, sourceQuestionId: req.source?.id ?? null, kind: req.kind, model: "test", outcome });
}
