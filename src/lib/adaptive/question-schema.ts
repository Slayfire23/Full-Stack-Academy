/**
 * Question shapes and structural validation.
 *
 * This validator is dependency-free on purpose: the same function checks seed content
 * (`npm run content:check`), admin edits, JSON imports, and AI-generated drafts before
 * they can enter the permanent question bank.
 */

export type QuestionType =
  | "FLASHCARD"
  | "MULTIPLE_CHOICE"
  | "MULTIPLE_SELECT"
  | "SHORT_ANSWER"
  | "CODE_READING"
  | "SCENARIO";
export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export const QUESTION_TYPES: readonly QuestionType[] = [
  "FLASHCARD",
  "MULTIPLE_CHOICE",
  "MULTIPLE_SELECT",
  "SHORT_ANSWER",
  "CODE_READING",
  "SCENARIO",
];
export const DIFFICULTIES: readonly Difficulty[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
export const OBJECTIVE_TYPES: readonly QuestionType[] = [
  "MULTIPLE_CHOICE",
  "MULTIPLE_SELECT",
  "SHORT_ANSWER",
  "CODE_READING",
];

export interface Option {
  id: string;
  text: string;
}

export interface RubricConcept {
  key: string;
  label: string;
  /** Any of these (normalized, stemmed) phrases counts as mentioning the concept. */
  keywords: string[];
}

export type AnswerData =
  | { kind: "FLASHCARD" }
  | { kind: "MULTIPLE_CHOICE"; options: Option[]; correctOptionIds: string[] }
  | { kind: "CODE_READING"; options: Option[]; correctOptionIds: string[] }
  | { kind: "MULTIPLE_SELECT"; options: Option[]; correctOptionIds: string[] }
  | { kind: "SHORT_ANSWER"; acceptedAnswers: string[] }
  | { kind: "SCENARIO"; modelAnswer: string; keyConcepts: RubricConcept[] };

/** The authoring shape: what seed files, imports and the AI produce. */
export interface QuestionDraft {
  externalKey?: string;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  answer: string;
  explanation: string;
  answerData: AnswerData;
  codeExample?: string | null;
  scenario?: string | null;
  tags: string[];
}

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export const LIMITS = {
  promptMin: 10,
  promptMax: 2000,
  answerMax: 4000,
  explanationMin: 30,
  explanationMax: 6000,
  codeMax: 4000,
  optionsMin: 3,
  optionsMax: 6,
  optionTextMax: 400,
  tagsMax: 10,
  tagMax: 40,
  conceptsMin: 3,
  conceptsMax: 8,
  modelAnswerMin: 120,
} as const;

/** Phrases that break once answer order is shuffled, or that betray a low-quality draft. */
const POSITIONAL_OPTION = /\b(all|none|both|neither) of the (above|below)\b|\boption [a-f]\b|\b(a|b|c|d) and (a|b|c|d)\b/i;
const PLACEHOLDER = /\b(lorem ipsum|todo|tbd|fixme|placeholder|as an ai( language model)?|i cannot|\[insert)/i;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function validateQuestionDraft(input: unknown): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (msg: string) => {
    errors.push(msg);
    return { ok: false, errors, warnings };
  };

  if (typeof input !== "object" || input === null) return fail("Question must be an object.");
  const q = input as Partial<QuestionDraft> & Record<string, unknown>;

  if (!QUESTION_TYPES.includes(q.type as QuestionType)) errors.push(`Unknown type "${String(q.type)}".`);
  if (!DIFFICULTIES.includes(q.difficulty as Difficulty)) errors.push(`Unknown difficulty "${String(q.difficulty)}".`);

  if (!isNonEmptyString(q.prompt)) errors.push("Prompt is required.");
  else {
    if (q.prompt.trim().length < LIMITS.promptMin) errors.push(`Prompt must be at least ${LIMITS.promptMin} characters.`);
    if (q.prompt.length > LIMITS.promptMax) errors.push(`Prompt must be at most ${LIMITS.promptMax} characters.`);
  }
  if (!isNonEmptyString(q.answer)) errors.push("Answer is required.");
  else if (q.answer.length > LIMITS.answerMax) errors.push(`Answer must be at most ${LIMITS.answerMax} characters.`);

  if (!isNonEmptyString(q.explanation)) errors.push("Explanation is required.");
  else {
    if (q.explanation.trim().length < LIMITS.explanationMin)
      errors.push(`Explanation must be at least ${LIMITS.explanationMin} characters — say why, not just what.`);
    if (q.explanation.length > LIMITS.explanationMax) errors.push("Explanation is too long.");
  }

  if (q.codeExample != null && typeof q.codeExample !== "string") errors.push("codeExample must be a string.");
  if (typeof q.codeExample === "string" && q.codeExample.length > LIMITS.codeMax) errors.push("codeExample is too long.");
  if (q.scenario != null && typeof q.scenario !== "string") errors.push("scenario must be a string.");

  if (!Array.isArray(q.tags)) errors.push("tags must be an array of strings.");
  else {
    if (q.tags.length > LIMITS.tagsMax) errors.push(`At most ${LIMITS.tagsMax} tags.`);
    for (const t of q.tags) {
      if (!isNonEmptyString(t) || t.length > LIMITS.tagMax || !/^[a-z0-9][a-z0-9-]*$/.test(t))
        errors.push(`Invalid tag "${String(t)}" (use lowercase-kebab-case).`);
    }
    if (new Set(q.tags).size !== q.tags.length) warnings.push("Duplicate tags.");
  }

  for (const field of ["prompt", "answer", "explanation"] as const) {
    const v = q[field];
    if (typeof v === "string" && PLACEHOLDER.test(v)) errors.push(`${field} contains placeholder or refusal text.`);
  }

  const ad = q.answerData as AnswerData | undefined;
  if (typeof ad !== "object" || ad === null) {
    errors.push("answerData is required.");
  } else if (ad.kind !== q.type) {
    errors.push(`answerData.kind (${String((ad as { kind?: unknown }).kind)}) must match type (${String(q.type)}).`);
  } else {
    validateAnswerData(q as QuestionDraft, ad, errors, warnings);
  }

  return { ok: errors.length === 0, errors, warnings };
}

function validateAnswerData(q: QuestionDraft, ad: AnswerData, errors: string[], warnings: string[]) {
  switch (ad.kind) {
    case "FLASHCARD":
      return;

    case "MULTIPLE_CHOICE":
    case "CODE_READING":
    case "MULTIPLE_SELECT": {
      const options = Array.isArray(ad.options) ? ad.options : [];
      const correct = Array.isArray(ad.correctOptionIds) ? ad.correctOptionIds : [];
      if (options.length < LIMITS.optionsMin || options.length > LIMITS.optionsMax)
        errors.push(`Provide ${LIMITS.optionsMin}–${LIMITS.optionsMax} options.`);

      const ids = new Set<string>();
      const texts = new Set<string>();
      for (const opt of options) {
        if (!opt || !isNonEmptyString(opt.id) || !/^[a-z0-9_-]{1,16}$/i.test(opt.id)) {
          errors.push("Each option needs a short id (letters, digits, - or _).");
          continue;
        }
        if (!isNonEmptyString(opt.text)) errors.push(`Option ${opt.id} has no text.`);
        else {
          if (opt.text.length > LIMITS.optionTextMax) errors.push(`Option ${opt.id} is too long.`);
          if (POSITIONAL_OPTION.test(opt.text))
            errors.push(`Option ${opt.id} refers to other options by position; answer order is shuffled per quiz.`);
          const norm = opt.text.trim().toLowerCase();
          if (texts.has(norm)) errors.push(`Duplicate option text "${opt.text}".`);
          texts.add(norm);
        }
        if (ids.has(opt.id)) errors.push(`Duplicate option id "${opt.id}".`);
        ids.add(opt.id);
      }

      if (new Set(correct).size !== correct.length) errors.push("correctOptionIds contains duplicates.");
      for (const id of correct) if (!ids.has(id)) errors.push(`correctOptionIds references unknown option "${id}".`);

      if (ad.kind === "MULTIPLE_SELECT") {
        if (correct.length < 2) errors.push("Multiple-select questions need at least 2 correct options.");
        if (correct.length >= options.length) errors.push("At least one option must be incorrect.");
      } else if (correct.length !== 1) {
        errors.push("Single-answer questions need exactly one correct option.");
      }

      if (ad.kind === "CODE_READING" && !isNonEmptyString(q.codeExample))
        errors.push("Code-reading questions require a codeExample.");

      // The canonical answer should name the right option(s); catches drafts whose key and text disagree.
      if (isNonEmptyString(q.answer) && correct.length > 0) {
        const answerNorm = q.answer.toLowerCase();
        const correctTexts = options.filter((o) => correct.includes(o.id)).map((o) => o.text.toLowerCase().trim());
        const mentionsAll = correctTexts.every((t) => t.length > 0 && answerNorm.includes(t.slice(0, Math.min(t.length, 40))));
        if (!mentionsAll) warnings.push("The answer text does not quote the correct option(s); check the key.");
      }
      return;
    }

    case "SHORT_ANSWER": {
      const accepted = Array.isArray(ad.acceptedAnswers) ? ad.acceptedAnswers : [];
      if (accepted.length === 0) errors.push("Short-answer questions need at least one accepted answer.");
      if (accepted.some((a) => !isNonEmptyString(a))) errors.push("Accepted answers must be non-empty strings.");
      if (accepted.some((a) => typeof a === "string" && a.length > 80))
        warnings.push("Long accepted answers are hard to match exactly; prefer short canonical forms.");
      return;
    }

    case "SCENARIO": {
      if (!isNonEmptyString(ad.modelAnswer) || ad.modelAnswer.trim().length < LIMITS.modelAnswerMin)
        errors.push(`Scenarios need a model answer of at least ${LIMITS.modelAnswerMin} characters.`);
      const concepts = Array.isArray(ad.keyConcepts) ? ad.keyConcepts : [];
      if (concepts.length < LIMITS.conceptsMin || concepts.length > LIMITS.conceptsMax)
        errors.push(`Scenarios need ${LIMITS.conceptsMin}–${LIMITS.conceptsMax} key concepts for the rubric.`);
      const keys = new Set<string>();
      for (const c of concepts) {
        if (!c || !isNonEmptyString(c.key) || !isNonEmptyString(c.label)) {
          errors.push("Each key concept needs a key and a label.");
          continue;
        }
        if (keys.has(c.key)) errors.push(`Duplicate concept key "${c.key}".`);
        keys.add(c.key);
        if (!Array.isArray(c.keywords) || c.keywords.filter(isNonEmptyString).length === 0)
          errors.push(`Concept "${c.key}" needs at least one keyword.`);
      }
      return;
    }

    default:
      errors.push("Unsupported answerData kind.");
  }
}
