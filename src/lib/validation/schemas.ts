import { z } from "zod";

/**
 * Request schemas for every API route. All incoming data is parsed here before it reaches
 * a service. Unknown keys are stripped (Zod's default), which prevents mass assignment.
 *
 * Written against the API surface shared by Zod 3.25+ and Zod 4.
 */

export const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

export const difficultySchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export const selectionModeSchema = z.enum(["NEW", "WEAK", "MIXED"]);
export const ratingSchema = z.enum(["AGAIN", "HARD", "GOOD", "EASY"]);
export const questionTypeSchema = z.enum([
  "FLASHCARD",
  "MULTIPLE_CHOICE",
  "MULTIPLE_SELECT",
  "SHORT_ANSWER",
  "CODE_READING",
  "SCENARIO",
]);
export const quizQuestionTypeSchema = z.enum([
  "MULTIPLE_CHOICE",
  "MULTIPLE_SELECT",
  "SHORT_ANSWER",
  "CODE_READING",
  "SCENARIO",
]);
export const themeSchema = z.enum(["SYSTEM", "DARK", "LIGHT"]);

const email = z.string().trim().toLowerCase().max(254).email("Enter a valid email address");
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters");

// ───────── Auth / account ─────────
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: password.optional(),
  })
  .refine((v) => !v.newPassword || !!v.currentPassword, {
    message: "Current password is required to set a new one",
    path: ["currentPassword"],
  });

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const settingsUpdateSchema = z.object({
  theme: themeSchema.optional(),
  dailyGoal: z.number().int().min(1).max(500).optional(),
  preferredDifficulty: difficultySchema.nullable().optional(),
  defaultSelectionMode: selectionModeSchema.optional(),
  recentWindowHours: z.number().int().min(0).max(720).optional(),
  timeZone: z.string().min(1).max(64).refine(isValidTimeZone, "Unknown time zone").optional(),
});

// ───────── Pagination ─────────
export const paginationSchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const questionListQuerySchema = paginationSchema.extend({
  topicId: idSchema.optional(),
  difficulty: difficultySchema.optional(),
  type: questionTypeSchema.optional(),
  q: z.string().trim().max(100).optional(),
});

// ───────── Quizzes ─────────
export const createQuizSchema = z.object({
  mode: selectionModeSchema.default("MIXED"),
  topicIds: z.array(idSchema).max(30).default([]),
  difficulty: difficultySchema.optional(),
  count: z.number().int().min(1).max(50).default(10),
  types: z.array(quizQuestionTypeSchema).min(1).max(5).optional(),
  feedbackMode: z.enum(["IMMEDIATE", "END"]).default("IMMEDIATE"),
  timeLimitSeconds: z.number().int().min(60).max(7200).nullable().optional(),
});

export const submittedAnswerSchema = z.union([
  z.object({ optionIds: z.array(z.string().min(1).max(16)).min(1).max(6) }),
  z.object({ text: z.string().trim().min(1, "Answer cannot be empty").max(8000) }),
]);

export const submitAnswerSchema = z.object({
  questionId: idSchema,
  answer: submittedAnswerSchema,
  responseTimeMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
});

export const retryQuizSchema = z.object({
  scope: z.enum(["incorrect", "all"]).default("incorrect"),
});

// ───────── Flashcards ─────────
export const flashcardQueueQuerySchema = z.object({
  topicIds: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean) : []))
    .pipe(z.array(idSchema).max(30)),
  difficulty: difficultySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  newLimit: z.coerce.number().int().min(0).max(50).default(10),
  bookmarkedOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  includeNew: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  incorrectOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const reviewSchema = z.object({
  questionId: idSchema,
  rating: ratingSchema,
  /** Client-generated per review; replaying the same key is a no-op. */
  idempotencyKey: z.string().min(8).max(100).optional(),
  sessionId: idSchema.optional(),
  responseTimeMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
});

export const flashcardSessionSchema = z.object({
  topicIds: z.array(idSchema).max(30).default([]),
  difficulty: difficultySchema.optional(),
  bookmarkedOnly: z.boolean().default(false),
  incorrectOnly: z.boolean().default(false),
  includeNew: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(30),
  newLimit: z.number().int().min(0).max(50).default(10),
});

export const flashcardSessionUpdateSchema = z.object({
  index: z.number().int().min(0).max(1000).optional(),
  end: z.boolean().optional(),
});

export const customFlashcardSchema = z.object({
  topicId: idSchema,
  difficulty: difficultySchema.default("BEGINNER"),
  prompt: z.string().trim().min(10).max(2000),
  answer: z.string().trim().min(1).max(4000),
  explanation: z.string().trim().max(6000).optional(),
  codeExample: z.string().max(4000).optional(),
  tags: z
    .array(z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]*$/).max(40))
    .max(10)
    .default([]),
});

/**
 * Update schemas are written out explicitly instead of using `.partial()`: under Zod 4,
 * `.partial()` still applies `.default()` values, so a PATCH that omits a field would reset it.
 */
export const customFlashcardUpdateSchema = z.object({
  topicId: idSchema.optional(),
  difficulty: difficultySchema.optional(),
  prompt: z.string().trim().min(10).max(2000).optional(),
  answer: z.string().trim().min(1).max(4000).optional(),
  explanation: z.string().trim().max(6000).optional(),
  codeExample: z.string().max(4000).optional(),
  tags: z
    .array(z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]*$/).max(40))
    .max(10)
    .optional(),
});

export const bookmarkSchema = z.object({ questionId: idSchema });

// ───────── Interviews ─────────
export const createInterviewSchema = z.object({
  topicId: idSchema.optional(),
  difficulty: difficultySchema.default("INTERMEDIATE"),
  mode: selectionModeSchema.default("MIXED"),
  count: z.number().int().min(1).max(5).default(3),
  /** Retry: practise these exact scenarios again (e.g. from a previous session). */
  questionIds: z.array(idSchema).min(1).max(5).optional(),
});

export const interviewResponseSchema = z.object({
  questionId: idSchema,
  response: z.string().trim().min(1, "Write an answer first").max(8000),
  /** Self-assessment against the rubric after revealing the model answer: { conceptKey: true }. */
  selfAssessment: z.record(z.string().max(64), z.boolean()).optional(),
});

// ───────── AI generation ─────────
export const generationRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("VARIATION"), questionId: idSchema }),
  z.object({ kind: z.literal("INTERVIEW_SCENARIO"), topicId: idSchema, difficulty: difficultySchema }),
]);

export const generationReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3).max(500) }),
]);

// ───────── Admin content management ─────────
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase-kebab-case");

export const trackSchema = z.object({
  slug,
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(""),
  published: z.boolean().default(false),
  order: z.number().int().min(0).max(1000).default(0),
});

export const topicSchema = z.object({
  trackId: idSchema,
  slug,
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(""),
  order: z.number().int().min(0).max(1000).default(0),
});

export const lessonSchema = z.object({
  topicId: idSchema,
  slug,
  title: z.string().trim().min(2).max(160),
  content: z.string().max(50_000),
  order: z.number().int().min(0).max(1000).default(0),
});

export const trackUpdateSchema = z.object({
  slug: slug.optional(),
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  published: z.boolean().optional(),
  order: z.number().int().min(0).max(1000).optional(),
});

export const topicUpdateSchema = z.object({
  trackId: idSchema.optional(),
  slug: slug.optional(),
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().min(0).max(1000).optional(),
});

export const lessonUpdateSchema = z.object({
  topicId: idSchema.optional(),
  slug: slug.optional(),
  title: z.string().trim().min(2).max(160).optional(),
  content: z.string().max(50_000).optional(),
  order: z.number().int().min(0).max(1000).optional(),
});

/**
 * Question payload for admin create/update and JSON import. `answerData` is checked
 * structurally by validateQuestionDraft (shared with seed and AI validation).
 */
export const questionInputSchema = z.object({
  externalKey: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
  topicId: idSchema.optional(),
  topicSlug: slug.optional(),
  type: questionTypeSchema,
  difficulty: difficultySchema,
  prompt: z.string(),
  answer: z.string(),
  explanation: z.string(),
  answerData: z.unknown(),
  codeExample: z.string().nullable().optional(),
  scenario: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(true),
});

export const questionImportSchema = z.object({
  trackSlug: slug.default("backend"),
  dryRun: z.boolean().default(false),
  /** What to do when a question with the same externalKey already exists. */
  onExisting: z.enum(["skip", "update"]).default("skip"),
  questions: z.array(questionInputSchema).min(1).max(500),
});

/** Turn a ZodError-like object into { field: message } pairs for API responses. */
export function fieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
