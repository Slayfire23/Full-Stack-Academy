import { contentHash, contentTokens, normalizeText } from "./text";

/**
 * Duplicate and near-duplicate detection.
 *
 * Two signals, combined:
 *  - character 3-gram Jaccard on the normalized text — robust to typos, punctuation and small edits
 *  - content-word Jaccard (stop-words removed, light stemming) — robust to reordering and filler words
 *
 * Similarity of two questions = 0.75 × prompt similarity + 0.25 × answer similarity, where each
 * text similarity is the max of the two signals. Thresholds (tuned against the seed bank, see tests):
 *   ≥ 0.82  duplicate  → rejected
 *   ≥ 0.60  similar    → allowed, but flagged for the reviewer
 */

export const SIMILARITY = {
  duplicate: 0.82,
  similar: 0.6,
  promptWeight: 0.75,
} as const;

export interface Fingerprint {
  id?: string;
  hash: string;
  promptGrams: Set<string>;
  promptWords: Set<string>;
  answerGrams: Set<string>;
  answerWords: Set<string>;
}

function charGrams(text: string, n = 3): Set<string> {
  const s = ` ${normalizeText(text)} `;
  const grams = new Set<string>();
  if (s.trim().length === 0) return grams;
  for (let i = 0; i + n <= s.length; i++) grams.add(s.slice(i, i + n));
  return grams;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function fingerprint(prompt: string, answer: string, id?: string): Fingerprint {
  return {
    id,
    hash: contentHash(prompt, answer),
    promptGrams: charGrams(prompt),
    promptWords: new Set(contentTokens(prompt)),
    answerGrams: charGrams(answer),
    answerWords: new Set(contentTokens(answer)),
  };
}

export function textSimilarity(aGrams: Set<string>, aWords: Set<string>, bGrams: Set<string>, bWords: Set<string>) {
  return Math.max(jaccard(aGrams, bGrams), jaccard(aWords, bWords));
}

export function questionSimilarity(a: Fingerprint, b: Fingerprint): number {
  if (a.hash === b.hash) return 1;
  const p = textSimilarity(a.promptGrams, a.promptWords, b.promptGrams, b.promptWords);
  const ans = textSimilarity(a.answerGrams, a.answerWords, b.answerGrams, b.answerWords);
  return SIMILARITY.promptWeight * p + (1 - SIMILARITY.promptWeight) * ans;
}

export type DuplicateVerdict = "unique" | "similar" | "duplicate";

export interface DuplicateCheck {
  verdict: DuplicateVerdict;
  score: number;
  nearestId: string | null;
  exact: boolean;
}

/** Compare a candidate against an existing corpus and report the closest match. */
export function checkDuplicate(candidate: Fingerprint, corpus: readonly Fingerprint[]): DuplicateCheck {
  let best = 0;
  let nearestId: string | null = null;
  for (const other of corpus) {
    if (other.hash === candidate.hash) return { verdict: "duplicate", score: 1, nearestId: other.id ?? null, exact: true };
    const s = questionSimilarity(candidate, other);
    if (s > best) {
      best = s;
      nearestId = other.id ?? null;
    }
  }
  const verdict: DuplicateVerdict =
    best >= SIMILARITY.duplicate ? "duplicate" : best >= SIMILARITY.similar ? "similar" : "unique";
  return { verdict, score: Math.round(best * 1000) / 1000, nearestId, exact: false };
}

/** All pairs in a set at or above a threshold — used by `content:check` to audit the bank. */
export function findSimilarPairs(items: readonly Fingerprint[], threshold: number) {
  const pairs: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const s = questionSimilarity(items[i]!, items[j]!);
      if (s >= threshold) pairs.push({ a: items[i]!.id ?? String(i), b: items[j]!.id ?? String(j), score: s });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}
