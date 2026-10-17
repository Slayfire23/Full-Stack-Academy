import { createRng, shuffle } from "./rng";
import type { CandidateQuestion, QuestionHistory } from "./selection";

/**
 * Flashcard study queue: due reviews first (most overdue first), then a capped number of
 * new cards, interleaved so a session is not 30 reviews followed by 10 new cards.
 */

export interface ReviewQueueOptions {
  now: Date;
  seed: number;
  limit: number;
  /** Max brand-new cards introduced in one session. */
  newLimit: number;
  includeNew?: boolean;
}

export interface QueueItem {
  questionId: string;
  kind: "due" | "new" | "learning";
  nextReviewAt: Date | null;
}

export function buildReviewQueue(
  candidates: readonly CandidateQuestion[],
  history: ReadonlyMap<string, QuestionHistory>,
  opts: ReviewQueueOptions,
): QueueItem[] {
  const rng = createRng(opts.seed);
  const now = opts.now.getTime();

  const due: QueueItem[] = [];
  const fresh: CandidateQuestion[] = [];
  for (const q of candidates) {
    const h = history.get(q.id);
    if (!h || h.timesSeen === 0 || !h.nextReviewAt) {
      fresh.push(q);
      continue;
    }
    if (h.nextReviewAt.getTime() <= now) {
      const learning = (h.lastCorrect === false) && now - h.nextReviewAt.getTime() < 60 * 60 * 1000;
      due.push({ questionId: q.id, kind: learning ? "learning" : "due", nextReviewAt: h.nextReviewAt });
    }
  }
  due.sort((a, b) => (a.nextReviewAt?.getTime() ?? 0) - (b.nextReviewAt?.getTime() ?? 0));

  const reviews = due.slice(0, opts.limit);
  const newSlots = opts.includeNew === false ? 0 : Math.max(0, Math.min(opts.newLimit, opts.limit - reviews.length));
  const news: QueueItem[] = shuffle(fresh, rng)
    .slice(0, newSlots)
    .map((q) => ({ questionId: q.id, kind: "new", nextReviewAt: null }));

  if (news.length === 0) return reviews;
  if (reviews.length === 0) return news;

  // Interleave: one new card after every `gap` reviews.
  const out: QueueItem[] = [];
  const gap = Math.max(1, Math.floor(reviews.length / news.length));
  let n = 0;
  reviews.forEach((r, i) => {
    out.push(r);
    if ((i + 1) % gap === 0 && n < news.length) out.push(news[n++]!);
  });
  while (n < news.length) out.push(news[n++]!);
  return out;
}

/** How many cards become due in each of the next `days` days (for the review-schedule chart). */
export function dueForecast(history: Iterable<QuestionHistory>, now: Date, days: number): number[] {
  const buckets = new Array<number>(days).fill(0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (const h of history) {
    if (!h.nextReviewAt) continue;
    const idx = Math.floor((h.nextReviewAt.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    if (idx < 0) buckets[0] = (buckets[0] ?? 0) + 1; // overdue counts as today
    else if (idx < days) buckets[idx] = (buckets[idx] ?? 0) + 1;
  }
  return buckets;
}
