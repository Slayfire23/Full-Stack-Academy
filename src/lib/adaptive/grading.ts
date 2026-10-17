import type { AnswerData, Option, QuestionType, RubricConcept } from "./question-schema";
import { contentTokens, normalizeText } from "./text";

/**
 * Server-side grading. Grading is keyed by option *id*, never by position, so the
 * per-quiz shuffled option order can never change whether an answer is right.
 */

export type SubmittedAnswer =
  | { optionIds: string[] } // MULTIPLE_CHOICE / MULTIPLE_SELECT / CODE_READING
  | { text: string }; // SHORT_ANSWER / SCENARIO / FLASHCARD free recall

export interface GradeResult {
  /** true/false for objective questions; null when the answer cannot be objectively graded. */
  correct: boolean | null;
  correctOptionIds?: string[];
  /** For multiple-select: how many of the right options were chosen and how many wrong ones. */
  partial?: { hits: number; misses: number; falsePicks: number };
  rubric?: RubricCoverage;
}

export interface RubricCoverage {
  /** Keyword heuristic only — NOT a grade. The UI labels it as such. */
  method: "keyword-coverage";
  covered: string[];
  missing: string[];
  ratio: number;
}

export class GradingError extends Error {}

export function gradeAnswer(type: QuestionType, answerData: AnswerData, submitted: SubmittedAnswer): GradeResult {
  switch (answerData.kind) {
    case "MULTIPLE_CHOICE":
    case "CODE_READING":
    case "MULTIPLE_SELECT": {
      if (!("optionIds" in submitted)) throw new GradingError("This question expects selected option ids.");
      const valid = new Set(answerData.options.map((o) => o.id));
      const chosen = [...new Set(submitted.optionIds)];
      if (chosen.some((id) => !valid.has(id))) throw new GradingError("Unknown option id submitted.");
      if (answerData.kind !== "MULTIPLE_SELECT" && chosen.length !== 1)
        throw new GradingError("Select exactly one option.");
      if (chosen.length === 0) throw new GradingError("Select at least one option.");

      const correctSet = new Set(answerData.correctOptionIds);
      const hits = chosen.filter((id) => correctSet.has(id)).length;
      const falsePicks = chosen.length - hits;
      const misses = correctSet.size - hits;
      return {
        // All-or-nothing: multiple-select is correct only when the chosen set equals the key.
        correct: falsePicks === 0 && misses === 0,
        correctOptionIds: [...answerData.correctOptionIds],
        partial: answerData.kind === "MULTIPLE_SELECT" ? { hits, misses, falsePicks } : undefined,
      };
    }

    case "SHORT_ANSWER": {
      if (!("text" in submitted)) throw new GradingError("This question expects a text answer.");
      const given = normalizeShort(submitted.text);
      if (!given) throw new GradingError("Answer is empty.");
      const correct = answerData.acceptedAnswers.some((a) => normalizeShort(a) === given);
      return { correct };
    }

    case "SCENARIO": {
      if (!("text" in submitted)) throw new GradingError("This question expects a written answer.");
      return { correct: null, rubric: rubricCoverage(submitted.text, answerData.keyConcepts) };
    }

    case "FLASHCARD":
      return { correct: null };

    default:
      throw new GradingError(`Cannot grade question type ${type}.`);
  }
}

/** Short answers: case/punctuation-insensitive, and "the"/"a" prefixes ignored. */
export function normalizeShort(s: string): string {
  return normalizeText(s).replace(/^(the|a|an) /, "");
}

/**
 * Which rubric concepts does a free-text answer mention? Matches stemmed keyword phrases.
 * Deliberately simple and transparent; it is a study aid, not a verdict.
 */
export function rubricCoverage(response: string, concepts: RubricConcept[]): RubricCoverage {
  const tokens = contentTokens(response);
  const joined = ` ${tokens.join(" ")} `;
  const covered: string[] = [];
  const missing: string[] = [];
  for (const c of concepts) {
    const hit = c.keywords.some((kw) => {
      const kwTokens = contentTokens(kw);
      return kwTokens.length > 0 && joined.includes(` ${kwTokens.join(" ")} `);
    });
    (hit ? covered : missing).push(c.key);
  }
  return {
    method: "keyword-coverage",
    covered,
    missing,
    ratio: concepts.length === 0 ? 0 : covered.length / concepts.length,
  };
}

// ───────────────────────── Public (answer-free) view ─────────────────────────

export interface PublicQuestionPayload {
  options?: Option[]; // in the quiz's shuffled order
  multiSelect?: boolean;
  expectsText?: boolean;
}

/**
 * What the browser may see before an answer is submitted: options in the per-quiz
 * order, and nothing that reveals the key.
 */
export function publicPayload(answerData: AnswerData, optionOrder: readonly string[]): PublicQuestionPayload {
  switch (answerData.kind) {
    case "MULTIPLE_CHOICE":
    case "CODE_READING":
    case "MULTIPLE_SELECT":
      return {
        options: orderOptions(answerData.options, optionOrder),
        multiSelect: answerData.kind === "MULTIPLE_SELECT",
      };
    case "SHORT_ANSWER":
    case "SCENARIO":
      return { expectsText: true };
    default:
      return {};
  }
}

export function orderOptions(options: readonly Option[], order: readonly string[]): Option[] {
  if (order.length === 0) return options.map((o) => ({ id: o.id, text: o.text }));
  const byId = new Map(options.map((o) => [o.id, o]));
  const ordered = order.map((id) => byId.get(id)).filter((o): o is Option => Boolean(o));
  // Any option missing from a stale order (e.g. edited after the quiz started) goes last.
  for (const o of options) if (!order.includes(o.id)) ordered.push(o);
  return ordered.map((o) => ({ id: o.id, text: o.text }));
}

export function optionIdsOf(answerData: AnswerData): string[] {
  return "options" in answerData ? answerData.options.map((o) => o.id) : [];
}
