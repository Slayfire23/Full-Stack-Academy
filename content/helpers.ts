import type { Difficulty, QuestionDraft, RubricConcept } from "../src/lib/adaptive/question-schema";

/**
 * Small builders that keep the seed content readable. Every builder returns a plain
 * QuestionDraft + topic slug; `npm run content:check` validates all of them with the same
 * validator used for imports and AI-generated questions.
 */

export interface SeedQuestion extends QuestionDraft {
  externalKey: string;
  topic: string;
}

type Extra = { code?: string; scenario?: string; tags?: string[] };
const B: Difficulty = "BEGINNER";
const I: Difficulty = "INTERMEDIATE";
const A: Difficulty = "ADVANCED";
export const D = { B, I, A };

const ids = ["a", "b", "c", "d", "e", "f"];

function tagsFor(topic: string, extra?: string[]) {
  return [...new Set([topic, ...(extra ?? [])])];
}

/** Flashcard: recall question with a canonical answer. */
export function fc(
  topic: string,
  key: string,
  difficulty: Difficulty,
  prompt: string,
  answer: string,
  explanation: string,
  extra: Extra = {},
): SeedQuestion {
  return {
    topic,
    externalKey: key,
    type: "FLASHCARD",
    difficulty,
    prompt,
    answer,
    explanation,
    answerData: { kind: "FLASHCARD" },
    codeExample: extra.code ?? null,
    scenario: extra.scenario ?? null,
    tags: tagsFor(topic, extra.tags),
  };
}

/** Multiple choice (or code-reading when `extra.code` is given). `correct` is the index of the right option. */
export function mc(
  topic: string,
  key: string,
  difficulty: Difficulty,
  prompt: string,
  options: string[],
  correct: number,
  explanation: string,
  extra: Extra = {},
): SeedQuestion {
  const kind = extra.code ? "CODE_READING" : "MULTIPLE_CHOICE";
  return {
    topic,
    externalKey: key,
    type: kind,
    difficulty,
    prompt,
    answer: options[correct]!,
    explanation,
    answerData: {
      kind,
      options: options.map((text, i) => ({ id: ids[i]!, text })),
      correctOptionIds: [ids[correct]!],
    },
    codeExample: extra.code ?? null,
    scenario: extra.scenario ?? null,
    tags: tagsFor(topic, extra.tags),
  };
}

/** Multiple select. `correct` lists the indexes of every right option. */
export function ms(
  topic: string,
  key: string,
  difficulty: Difficulty,
  prompt: string,
  options: string[],
  correct: number[],
  explanation: string,
  extra: Extra = {},
): SeedQuestion {
  return {
    topic,
    externalKey: key,
    type: "MULTIPLE_SELECT",
    difficulty,
    prompt,
    answer: correct.map((i) => options[i]!).join("; "),
    explanation,
    answerData: {
      kind: "MULTIPLE_SELECT",
      options: options.map((text, i) => ({ id: ids[i]!, text })),
      correctOptionIds: correct.map((i) => ids[i]!),
    },
    codeExample: extra.code ?? null,
    scenario: extra.scenario ?? null,
    tags: tagsFor(topic, extra.tags),
  };
}

/** Short answer graded by exact (normalised) match against the accepted list. */
export function sa(
  topic: string,
  key: string,
  difficulty: Difficulty,
  prompt: string,
  accepted: string[],
  explanation: string,
  extra: Extra = {},
): SeedQuestion {
  return {
    topic,
    externalKey: key,
    type: "SHORT_ANSWER",
    difficulty,
    prompt,
    answer: accepted[0]!,
    explanation,
    answerData: { kind: "SHORT_ANSWER", acceptedAnswers: accepted },
    codeExample: extra.code ?? null,
    scenario: extra.scenario ?? null,
    tags: tagsFor(topic, extra.tags),
  };
}

/** Scenario / interview question with a model answer and a keyword rubric. */
export function sc(
  topic: string,
  key: string,
  difficulty: Difficulty,
  prompt: string,
  summary: string,
  modelAnswer: string,
  concepts: [key: string, label: string, keywords: string[]][],
  explanation: string,
  extra: Extra = {},
): SeedQuestion {
  const keyConcepts: RubricConcept[] = concepts.map(([k, label, keywords]) => ({ key: k, label, keywords }));
  return {
    topic,
    externalKey: key,
    type: "SCENARIO",
    difficulty,
    prompt,
    answer: summary,
    explanation,
    answerData: { kind: "SCENARIO", modelAnswer, keyConcepts },
    codeExample: extra.code ?? null,
    scenario: extra.scenario ?? null,
    tags: tagsFor(topic, extra.tags),
  };
}
