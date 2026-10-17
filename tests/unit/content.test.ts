import { describe, it, expect } from "vitest";
import { allQuestions, curriculum } from "../../content";
import { validateQuestionDraft, OBJECTIVE_TYPES } from "@/lib/adaptive/question-schema";
import { findSimilarPairs, fingerprint, SIMILARITY } from "@/lib/adaptive/similarity";
import { gradeAnswer, rubricCoverage } from "@/lib/adaptive/grading";
import { stem } from "@/lib/adaptive/text";

describe("seed question bank", () => {
  it("meets the roadmap minimums", () => {
    expect(allQuestions.length).toBeGreaterThanOrEqual(150);
    expect(allQuestions.filter((q) => q.type === "FLASHCARD").length).toBeGreaterThanOrEqual(80);
    expect(allQuestions.filter((q) => OBJECTIVE_TYPES.includes(q.type)).length).toBeGreaterThanOrEqual(40);
    expect(allQuestions.filter((q) => q.type === "SCENARIO").length).toBeGreaterThanOrEqual(30);
  });

  it("covers all 22 topics with every question attached to a known topic", () => {
    expect(curriculum.topics).toHaveLength(22);
    const slugs = new Set(curriculum.topics.map((t) => t.slug));
    for (const q of allQuestions) expect(slugs.has(q.topic)).toBe(true);
  });

  it("passes the same validator used for imports and AI drafts", () => {
    const failures = allQuestions
      .map((q) => ({ key: q.externalKey, r: validateQuestionDraft(q) }))
      .filter((x) => !x.r.ok)
      .map((x) => `${x.key}: ${x.r.errors.join("; ")}`);
    expect(failures).toEqual([]);
  });

  it("has unique keys and no near-duplicate questions", () => {
    expect(new Set(allQuestions.map((q) => q.externalKey)).size).toBe(allQuestions.length);
    const prints = allQuestions.map((q) => fingerprint(q.prompt, q.answer, q.externalKey));
    expect(findSimilarPairs(prints, SIMILARITY.duplicate)).toEqual([]);
  });

  it("grades every answer key as correct and every model answer as covering its rubric", () => {
    for (const q of allQuestions) {
      const ad = q.answerData;
      if ("correctOptionIds" in ad) expect(gradeAnswer(q.type, ad, { optionIds: ad.correctOptionIds }).correct).toBe(true);
      if (ad.kind === "SHORT_ANSWER") for (const a of ad.acceptedAnswers) expect(gradeAnswer(q.type, ad, { text: a }).correct).toBe(true);
      if (ad.kind === "SCENARIO") expect(rubricCoverage(ad.modelAnswer, ad.keyConcepts).missing).toEqual([]);
    }
  });
});

describe("stemmer", () => {
  it("collapses common inflections", () => {
    expect(stem("keys")).toBe(stem("key"));
    expect(stem("inferred")).toBe(stem("infer"));
    expect(stem("tuned")).toBe(stem("tune"));
    expect(stem("transactions")).toBe(stem("transaction"));
    expect(stem("retries")).toBe(stem("retry"));
    expect(stem("locking")).toBe(stem("lock"));
  });
  it("leaves short words, numbers and -ss/-us/-is words alone", () => {
    expect(stem("429")).toBe("429");
    expect(stem("pass")).toBe("pass");
    expect(stem("status")).toBe("status");
    expect(stem("redis")).toBe("redis");
  });
});
