import { describe, it, expect } from "vitest";
import { validateQuestionDraft, type QuestionDraft } from "@/lib/adaptive/question-schema";
import { checkDuplicate, fingerprint, questionSimilarity, SIMILARITY } from "@/lib/adaptive/similarity";
import { contentHash } from "@/lib/adaptive/text";

const good: QuestionDraft = {
  type: "MULTIPLE_CHOICE",
  difficulty: "BEGINNER",
  prompt: "Which status code should a successful POST that creates a resource return?",
  answer: "201 Created",
  explanation: "201 Created signals a new resource was created; include a Location header pointing at it.",
  answerData: {
    kind: "MULTIPLE_CHOICE",
    options: [
      { id: "a", text: "200 OK" },
      { id: "b", text: "201 Created" },
      { id: "c", text: "204 No Content" },
    ],
    correctOptionIds: ["b"],
  },
  tags: ["http", "status-codes"],
};

const mcData = good.answerData as Extract<QuestionDraft["answerData"], { kind: "MULTIPLE_CHOICE" }>;

const withData = (answerData: QuestionDraft["answerData"], extra: Partial<QuestionDraft> = {}): QuestionDraft => ({
  ...good,
  type: answerData.kind,
  answerData,
  ...extra,
});

describe("validateQuestionDraft", () => {
  it("accepts a well-formed question", () => {
    const r = validateQuestionDraft(good);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("rejects non-objects and missing fields", () => {
    expect(validateQuestionDraft(null).ok).toBe(false);
    expect(validateQuestionDraft({ ...good, prompt: "" }).errors.join()).toMatch(/Prompt is required/);
    expect(validateQuestionDraft({ ...good, explanation: "Because." }).errors.join()).toMatch(/at least 30/);
  });

  it("rejects answerData that does not match the type", () => {
    expect(validateQuestionDraft({ ...good, type: "SHORT_ANSWER" }).errors.join()).toMatch(/must match type/);
  });

  it("rejects a key that references a missing option", () => {
    const r = validateQuestionDraft(withData({ ...mcData, correctOptionIds: ["z"] }));
    expect(r.errors.join()).toMatch(/unknown option "z"/);
  });

  it("rejects single-answer questions with two correct options", () => {
    const r = validateQuestionDraft(withData({ ...mcData, correctOptionIds: ["a", "b"] }));
    expect(r.errors.join()).toMatch(/exactly one correct/);
  });

  it("rejects positional options that break under shuffling", () => {
    const r = validateQuestionDraft(
      withData({
        kind: "MULTIPLE_CHOICE",
        options: [
          { id: "a", text: "200 OK" },
          { id: "b", text: "201 Created" },
          { id: "c", text: "All of the above" },
        ],
        correctOptionIds: ["b"],
      }),
    );
    expect(r.errors.join()).toMatch(/shuffled/);
  });

  it("rejects duplicate option text and too few options", () => {
    const r = validateQuestionDraft(
      withData({
        kind: "MULTIPLE_CHOICE",
        options: [
          { id: "a", text: "201 Created" },
          { id: "b", text: "201 created" },
        ],
        correctOptionIds: ["a"],
      }),
    );
    expect(r.errors.join()).toMatch(/Duplicate option text/);
    expect(r.errors.join()).toMatch(/3–6 options/);
  });

  it("requires 2+ correct and 1+ incorrect for multiple-select", () => {
    const opts = [
      { id: "a", text: "GET" },
      { id: "b", text: "PUT" },
      { id: "c", text: "POST" },
    ];
    expect(validateQuestionDraft(withData({ kind: "MULTIPLE_SELECT", options: opts, correctOptionIds: ["a"] }, { answer: "GET" })).ok).toBe(false);
    expect(
      validateQuestionDraft(withData({ kind: "MULTIPLE_SELECT", options: opts, correctOptionIds: ["a", "b", "c"] }, { answer: "GET, PUT, POST" })).ok,
    ).toBe(false);
  });

  it("requires code for code-reading questions", () => {
    const r = validateQuestionDraft(withData({ ...mcData, kind: "CODE_READING" }));
    expect(r.errors.join()).toMatch(/require a codeExample/);
  });

  it("requires a real rubric for scenarios", () => {
    const r = validateQuestionDraft(withData({ kind: "SCENARIO", modelAnswer: "short", keyConcepts: [] }));
    expect(r.errors.join()).toMatch(/model answer/);
    expect(r.errors.join()).toMatch(/key concepts/);
  });

  it("rejects placeholder or refusal text from a model", () => {
    expect(validateQuestionDraft({ ...good, explanation: "As an AI language model I cannot be sure, but 201 is right." }).ok).toBe(false);
    expect(validateQuestionDraft({ ...good, answer: "TODO" }).ok).toBe(false);
  });

  it("enforces kebab-case tags", () => {
    expect(validateQuestionDraft({ ...good, tags: ["HTTP Codes"] }).ok).toBe(false);
  });

  it("warns when the answer text disagrees with the key", () => {
    const r = validateQuestionDraft({ ...good, answer: "200 OK" });
    expect(r.ok).toBe(true);
    expect(r.warnings.join()).toMatch(/does not quote/);
  });
});

describe("duplicate detection", () => {
  const corpus = [
    fingerprint("What does HTTP 404 mean?", "The server cannot find the requested resource.", "q404"),
    fingerprint("How do you prevent duplicate payment charges when a client retries?", "Use an idempotency key stored with a unique constraint.", "qpay"),
    fingerprint("What is a database index?", "A data structure that speeds up lookups at the cost of extra writes.", "qidx"),
  ];

  it("treats case/punctuation-only changes as exact duplicates", () => {
    expect(contentHash("What does HTTP 404 mean?", "x")).toBe(contentHash("what does http 404 mean", "X."));
    const r = checkDuplicate(fingerprint("WHAT does HTTP 404 mean", "The server cannot find the requested resource"), corpus);
    expect(r.verdict).toBe("duplicate");
    expect(r.exact).toBe(true);
  });

  it("catches light rewording as a near-duplicate", () => {
    const r = checkDuplicate(
      fingerprint(
        "How would you prevent duplicate payment charges when the client retries?",
        "Use an idempotency key, stored with a unique constraint.",
      ),
      corpus,
    );
    expect(r.verdict).toBe("duplicate");
    expect(r.nearestId).toBe("qpay");
    expect(r.score).toBeGreaterThanOrEqual(SIMILARITY.duplicate);
  });

  it("allows a genuinely different question on the same topic", () => {
    const r = checkDuplicate(
      fingerprint(
        "A webhook provider delivers the same event three times. How do you make the handler safe?",
        "Record processed event ids in a table with a unique constraint and skip repeats.",
      ),
      corpus,
    );
    expect(r.verdict).not.toBe("duplicate");
  });

  it("scores unrelated questions low", () => {
    const s = questionSimilarity(corpus[0]!, corpus[2]!);
    expect(s).toBeLessThan(0.3);
  });
});
