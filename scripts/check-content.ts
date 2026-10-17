/**
 * Validates the seed question bank with the same rules applied to imports and AI drafts:
 *   npm run content:check
 * Fails (exit 1) on any validation error, unknown topic, duplicate key, near-duplicate pair,
 * or when the bank falls below the roadmap's minimum counts.
 */
import { validateQuestionDraft, OBJECTIVE_TYPES } from "../src/lib/adaptive/question-schema";
import { findSimilarPairs, fingerprint, SIMILARITY } from "../src/lib/adaptive/similarity";
import { gradeAnswer, rubricCoverage } from "../src/lib/adaptive/grading";
import { curriculum } from "../content/curriculum";
import { allQuestions } from "../content";

const MIN = { total: 150, flashcards: 80, objective: 40, scenarios: 30 };

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`✗ ${msg}`);
};

const topicSlugs = new Set(curriculum.topics.map((t) => t.slug));
const keys = new Set<string>();
let warnings = 0;

for (const q of allQuestions) {
  if (keys.has(q.externalKey)) fail(`duplicate externalKey ${q.externalKey}`);
  keys.add(q.externalKey);
  if (!topicSlugs.has(q.topic)) fail(`${q.externalKey}: unknown topic "${q.topic}"`);
  const r = validateQuestionDraft(q);
  for (const e of r.errors) fail(`${q.externalKey}: ${e}`);
  for (const w of r.warnings) {
    warnings++;
    console.warn(`! ${q.externalKey}: ${w}`);
  }
}

// Self-consistency: keys grade as correct, and each model answer covers its own rubric.
for (const q of allQuestions) {
  const ad = q.answerData;
  if (ad.kind === "MULTIPLE_CHOICE" || ad.kind === "CODE_READING" || ad.kind === "MULTIPLE_SELECT") {
    if (gradeAnswer(q.type, ad, { optionIds: ad.correctOptionIds }).correct !== true) fail(`${q.externalKey}: key does not grade as correct`);
    const wrong = ad.options.find((o) => !ad.correctOptionIds.includes(o.id))!;
    if (gradeAnswer(q.type, ad, { optionIds: [wrong.id] }).correct !== false) fail(`${q.externalKey}: wrong option grades as correct`);
  } else if (ad.kind === "SHORT_ANSWER") {
    for (const a of ad.acceptedAnswers)
      if (gradeAnswer(q.type, ad, { text: a }).correct !== true) fail(`${q.externalKey}: accepted answer "${a}" does not grade`);
  } else if (ad.kind === "SCENARIO") {
    const cov = rubricCoverage(ad.modelAnswer, ad.keyConcepts);
    if (cov.missing.length > 0) fail(`${q.externalKey}: model answer misses its own rubric concepts: ${cov.missing.join(", ")}`);
  }
}

const prints = allQuestions.map((q) => fingerprint(q.prompt, q.answer, q.externalKey));
const dupes = findSimilarPairs(prints, SIMILARITY.duplicate);
for (const d of dupes) fail(`near-duplicate pair ${d.a} ~ ${d.b} (${d.score.toFixed(3)})`);
const similar = findSimilarPairs(prints, SIMILARITY.similar).filter((p) => p.score < SIMILARITY.duplicate);
for (const s of similar) console.warn(`~ similar: ${s.a} ~ ${s.b} (${s.score.toFixed(3)})`);

const count = (pred: (q: (typeof allQuestions)[number]) => boolean) => allQuestions.filter(pred).length;
const totals = {
  total: allQuestions.length,
  flashcards: count((q) => q.type === "FLASHCARD"),
  objective: count((q) => OBJECTIVE_TYPES.includes(q.type)),
  scenarios: count((q) => q.type === "SCENARIO"),
};
for (const [k, min] of Object.entries(MIN)) {
  const have = totals[k as keyof typeof totals];
  if (have < min) fail(`only ${have} ${k}; roadmap requires ${min}`);
}

const perTopic = new Map<string, number>();
for (const q of allQuestions) perTopic.set(q.topic, (perTopic.get(q.topic) ?? 0) + 1);
for (const t of curriculum.topics) {
  const n = perTopic.get(t.slug) ?? 0;
  if (n < 5) fail(`topic ${t.slug} has only ${n} questions`);
}
const difficulties = new Set(allQuestions.map((q) => q.difficulty));
if (difficulties.size < 3) fail("bank must cover beginner, intermediate and advanced");

console.log(
  `\nQuestions: ${totals.total} (flashcards ${totals.flashcards}, objective ${totals.objective}, scenarios ${totals.scenarios})` +
    ` across ${perTopic.size} topics; lessons: ${curriculum.topics.length}; ` +
    `difficulty: ${["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((d) => `${d.toLowerCase()} ${count((q) => q.difficulty === d)}`).join(", ")}` +
    `\nWarnings: ${warnings}, similar pairs (allowed, reviewed): ${similar.length}, failures: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
