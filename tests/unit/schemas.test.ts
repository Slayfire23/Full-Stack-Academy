import { describe, it, expect } from "vitest";
import {
  createQuizSchema,
  customFlashcardSchema,
  fieldErrors,
  flashcardQueueQuerySchema,
  generationRequestSchema,
  questionImportSchema,
  registerSchema,
  reviewSchema,
  settingsUpdateSchema,
  submitAnswerSchema,
  profileUpdateSchema,
  trackUpdateSchema,
  topicUpdateSchema,
  lessonUpdateSchema,
  customFlashcardUpdateSchema,
} from "@/lib/validation/schemas";

describe("API request validation", () => {
  it("normalises registration input and strips unknown fields (no mass assignment)", () => {
    const r = registerSchema.safeParse({ name: "  Ada ", email: " ADA@Example.COM ", password: "correct horse", role: "ADMIN" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ name: "Ada", email: "ada@example.com", password: "correct horse" });
      expect("role" in r.data).toBe(false);
    }
  });

  it("rejects weak passwords and bad emails with field errors", () => {
    const r = registerSchema.safeParse({ name: "A", email: "nope", password: "short" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error.issues);
      expect(Object.keys(errs).sort()).toEqual(["email", "password"]);
    }
  });

  it("applies quiz defaults and bounds", () => {
    const r = createQuizSchema.parse({});
    expect(r).toEqual({ mode: "MIXED", topicIds: [], count: 10, feedbackMode: "IMMEDIATE" });
    expect(createQuizSchema.safeParse({ count: 500 }).success).toBe(false);
    expect(createQuizSchema.safeParse({ mode: "RANDOM" }).success).toBe(false);
    expect(createQuizSchema.safeParse({ types: ["FLASHCARD"] }).success).toBe(false);
  });

  it("accepts either option ids or text as an answer, never both shapes mixed up", () => {
    expect(submitAnswerSchema.safeParse({ questionId: "q1", answer: { optionIds: ["a"] } }).success).toBe(true);
    expect(submitAnswerSchema.safeParse({ questionId: "q1", answer: { text: "409" } }).success).toBe(true);
    expect(submitAnswerSchema.safeParse({ questionId: "q1", answer: { optionIds: [] } }).success).toBe(false);
    expect(submitAnswerSchema.safeParse({ questionId: "q1", answer: { text: "   " } }).success).toBe(false);
    expect(submitAnswerSchema.safeParse({ questionId: "../etc/passwd", answer: { text: "x" } }).success).toBe(false);
  });

  it("validates flashcard reviews", () => {
    expect(reviewSchema.safeParse({ questionId: "q1", rating: "GOOD", idempotencyKey: "abcdefgh-1" }).success).toBe(true);
    expect(reviewSchema.safeParse({ questionId: "q1", rating: "PERFECT" }).success).toBe(false);
  });

  it("parses flashcard queue query strings", () => {
    const r = flashcardQueueQuerySchema.parse({ topicIds: "t1,t2", limit: "15", bookmarkedOnly: "true" });
    expect(r.topicIds).toEqual(["t1", "t2"]);
    expect(r.limit).toBe(15);
    expect(r.bookmarkedOnly).toBe(true);
    expect(r.includeNew).toBe(true);
  });

  it("normalises custom flashcard tags", () => {
    const r = customFlashcardSchema.parse({ topicId: "t1", prompt: "What is a mutex used for?", answer: "Mutual exclusion", tags: ["Locks"] });
    expect(r.tags).toEqual(["locks"]);
    expect(r.difficulty).toBe("BEGINNER");
  });

  it("discriminates generation requests by kind", () => {
    expect(generationRequestSchema.safeParse({ kind: "VARIATION", questionId: "q1" }).success).toBe(true);
    expect(generationRequestSchema.safeParse({ kind: "INTERVIEW_SCENARIO", topicId: "t1" }).success).toBe(false);
  });

  it("validates time zones and settings ranges", () => {
    expect(settingsUpdateSchema.safeParse({ timeZone: "America/Chicago" }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ timeZone: "Mars/Olympus" }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ recentWindowHours: 1000 }).success).toBe(false);
  });

  it("requires the current password to change the password", () => {
    expect(profileUpdateSchema.safeParse({ newPassword: "a-new-password" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ newPassword: "a-new-password", currentPassword: "old" }).success).toBe(true);
  });

  it("caps import size and applies import defaults", () => {
    const one = { type: "FLASHCARD", difficulty: "BEGINNER", prompt: "p", answer: "a", explanation: "e", answerData: {} };
    const r = questionImportSchema.parse({ questions: [one] });
    expect(r.dryRun).toBe(false);
    expect(r.onExisting).toBe("skip");
    expect(questionImportSchema.safeParse({ questions: Array(501).fill(one) }).success).toBe(false);
  });

  it("PATCH schemas never inject defaults for omitted fields (Zod 4 .partial() pitfall)", () => {
    expect(trackUpdateSchema.parse({ title: "New title" })).toEqual({ title: "New title" });
    expect(topicUpdateSchema.parse({})).toEqual({});
    expect(lessonUpdateSchema.parse({ order: 2 })).toEqual({ order: 2 });
    expect(customFlashcardUpdateSchema.parse({ answer: "x" })).toEqual({ answer: "x" });
  });
});
