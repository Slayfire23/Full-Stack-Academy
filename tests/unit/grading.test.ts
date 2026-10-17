import { describe, it, expect } from "vitest";
import { gradeAnswer, normalizeShort, orderOptions, publicPayload, rubricCoverage, GradingError } from "@/lib/adaptive/grading";
import type { AnswerData } from "@/lib/adaptive/question-schema";

const mc: AnswerData = {
  kind: "MULTIPLE_CHOICE",
  options: [
    { id: "a", text: "200 OK" },
    { id: "b", text: "201 Created" },
    { id: "c", text: "204 No Content" },
  ],
  correctOptionIds: ["b"],
};
const ms: AnswerData = {
  kind: "MULTIPLE_SELECT",
  options: [
    { id: "a", text: "GET" },
    { id: "b", text: "PUT" },
    { id: "c", text: "POST" },
    { id: "d", text: "DELETE" },
  ],
  correctOptionIds: ["a", "b", "d"],
};

describe("objective grading", () => {
  it("grades multiple choice by option id", () => {
    expect(gradeAnswer("MULTIPLE_CHOICE", mc, { optionIds: ["b"] }).correct).toBe(true);
    expect(gradeAnswer("MULTIPLE_CHOICE", mc, { optionIds: ["a"] }).correct).toBe(false);
  });

  it("is unaffected by the shuffled display order", () => {
    const shown = orderOptions(mc.kind === "MULTIPLE_CHOICE" ? mc.options : [], ["c", "b", "a"]);
    const pickedId = shown[1]!.id; // user clicked the second option on screen
    expect(gradeAnswer("MULTIPLE_CHOICE", mc, { optionIds: [pickedId] }).correct).toBe(true);
  });

  it("requires exactly one choice for single-answer questions", () => {
    expect(() => gradeAnswer("MULTIPLE_CHOICE", mc, { optionIds: ["a", "b"] })).toThrow(/exactly one/);
  });

  it("rejects unknown option ids", () => {
    expect(() => gradeAnswer("MULTIPLE_CHOICE", mc, { optionIds: ["z"] })).toThrow(/Unknown option/);
  });

  it("grades multiple-select all-or-nothing and reports partial credit", () => {
    const exact = gradeAnswer("MULTIPLE_SELECT", ms, { optionIds: ["d", "a", "b"] });
    expect(exact.correct).toBe(true);
    const partial = gradeAnswer("MULTIPLE_SELECT", ms, { optionIds: ["a", "c"] });
    expect(partial.correct).toBe(false);
    expect(partial.partial).toEqual({ hits: 1, misses: 2, falsePicks: 1 });
  });

  it("ignores duplicate ids in a submission", () => {
    expect(gradeAnswer("MULTIPLE_SELECT", ms, { optionIds: ["a", "a", "b", "d"] }).correct).toBe(true);
  });

  it("grades short answers case- and punctuation-insensitively", () => {
    const sa: AnswerData = { kind: "SHORT_ANSWER", acceptedAnswers: ["409 Conflict", "409"] };
    expect(gradeAnswer("SHORT_ANSWER", sa, { text: "  409 conflict. " }).correct).toBe(true);
    expect(gradeAnswer("SHORT_ANSWER", sa, { text: "409" }).correct).toBe(true);
    expect(gradeAnswer("SHORT_ANSWER", sa, { text: "400" }).correct).toBe(false);
    expect(normalizeShort("The Idempotency-Key")).toBe("idempotency key");
  });

  it("rejects the wrong submission shape", () => {
    expect(() => gradeAnswer("MULTIPLE_CHOICE", mc, { text: "b" })).toThrow(GradingError);
  });
});

describe("open-ended answers are never presented as objectively graded", () => {
  const scenario: AnswerData = {
    kind: "SCENARIO",
    modelAnswer: "x".repeat(130),
    keyConcepts: [
      { key: "idem", label: "Idempotency key", keywords: ["idempotency key", "idempotent"] },
      { key: "unique", label: "Unique constraint", keywords: ["unique constraint", "unique index"] },
      { key: "tx", label: "Transaction", keywords: ["transaction"] },
    ],
  };

  it("returns correct = null with keyword coverage", () => {
    const r = gradeAnswer("SCENARIO", scenario, {
      text: "I'd require an Idempotency-Key header and store it behind a UNIQUE index, inside one transaction.",
    });
    expect(r.correct).toBeNull();
    expect(r.rubric?.method).toBe("keyword-coverage");
    expect(r.rubric?.covered).toEqual(["idem", "unique", "tx"]);
  });

  it("reports missing concepts", () => {
    const r = rubricCoverage("Just retry it.", scenario.kind === "SCENARIO" ? scenario.keyConcepts : []);
    expect(r.missing).toHaveLength(3);
    expect(r.ratio).toBe(0);
  });

  it("matches keyword stems (transactions → transaction)", () => {
    const r = rubricCoverage("wrap both writes in database transactions", scenario.kind === "SCENARIO" ? scenario.keyConcepts : []);
    expect(r.covered).toContain("tx");
  });
});

describe("public payload hides answer keys", () => {
  it("exposes options in quiz order but no correct ids", () => {
    const p = publicPayload(mc, ["c", "a", "b"]);
    expect(p.options?.map((o) => o.id)).toEqual(["c", "a", "b"]);
    expect(JSON.stringify(p)).not.toContain("correct");
  });

  it("appends options missing from a stale order", () => {
    expect(orderOptions(mc.kind === "MULTIPLE_CHOICE" ? mc.options : [], ["b"]).map((o) => o.id)).toEqual(["b", "a", "c"]);
  });

  it("never leaks accepted short answers or model answers", () => {
    expect(JSON.stringify(publicPayload({ kind: "SHORT_ANSWER", acceptedAnswers: ["secret"] }, []))).not.toContain("secret");
    expect(
      JSON.stringify(publicPayload({ kind: "SCENARIO", modelAnswer: "secret model", keyConcepts: [] }, [])),
    ).not.toContain("secret");
  });
});
