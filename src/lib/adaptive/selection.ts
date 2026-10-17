import { createRng, shuffle, weightedSample, type Rng } from "./rng";

/**
 * Adaptive question selection.
 *
 * Pure function: give it the candidate pool, the user's per-question history and a seed,
 * get back an ordered list of picks with the reason each was picked. The service layer
 * loads the data; this module makes every decision, which keeps it fully unit-testable.
 *
 * Pipeline
 *  1. Classify every candidate for this user: unseen, due for review, previously missed,
 *     recently seen, in a weak topic, mastered.
 *  2. Score it for the requested mode (NEW / WEAK / MIXED).
 *  3. Split into tiers. Questions seen inside the recency window go to a *fallback* tier
 *     that is only used when the fresh tier cannot fill the quiz.
 *  4. Fill priority tiers in order (NEW: unseen first; WEAK: missed/due, then weak topics;
 *     MIXED: review/weak/new quotas), each by weighted random sampling without replacement —
 *     the kind of question is guaranteed, the specific questions vary between sessions.
 *  5. A per-topic cap keeps a multi-topic session from collapsing onto a single topic.
 *  6. Shuffle the final order so priority items are not front-loaded.
 */

export type SelectionMode = "NEW" | "WEAK" | "MIXED";

export type SelectionReason =
  | "due" // spaced-repetition review is due
  | "incorrect" // the user got it wrong last time / struggles with it
  | "weak-topic" // belongs to one of the user's weakest topics
  | "new" // never seen
  | "fresh" // seen before, not recently, nothing urgent
  | "fallback"; // seen recently; used only because there were not enough alternatives

export interface CandidateQuestion {
  id: string;
  topicId: string;
  difficulty?: string;
  type?: string;
}

export interface QuestionHistory {
  timesSeen: number;
  timesCorrect: number;
  timesIncorrect: number;
  consecutiveCorrect: number;
  lastCorrect: boolean | null;
  lastSeenAt: Date | null;
  nextReviewAt: Date | null;
  lapses?: number;
}

export interface TopicPerformance {
  attempts: number;
  correct: number;
}

export interface SelectionOptions {
  mode: SelectionMode;
  count: number;
  now: Date;
  seed: number;
  /** Questions answered within this window are avoided while alternatives exist. Default 24h. */
  recentWindowHours?: number;
  /** Max share of the quiz any single topic may take when several topics are available. Default 0.4. */
  maxTopicShare?: number;
  /** MIXED-mode quotas; must sum to 1. */
  mixedQuotas?: { review: number; weak: number; new: number };
}

export interface Pick {
  questionId: string;
  topicId: string;
  reason: SelectionReason;
  weight: number;
}

export interface SelectionResult {
  picks: Pick[];
  diagnostics: {
    poolSize: number;
    freshPoolSize: number;
    usedRecentFallback: boolean;
    weakTopicIds: string[];
    byReason: Record<SelectionReason, number>;
    shortfall: number; // requested − delivered (pool too small)
  };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SELECTION_DEFAULTS = {
  recentWindowHours: 24,
  maxTopicShare: 0.4,
  mixedQuotas: { review: 0.4, weak: 0.2, new: 0.4 },
  /** A topic is weak when its smoothed accuracy is below this... */
  weakAccuracy: 0.7,
  /** ...and it has at least this many graded answers. */
  weakMinAttempts: 3,
  /** Consecutive correct answers after which a non-due question counts as mastered. */
  masteredStreak: 3,
} as const;

// ───────────────────────── Classification ─────────────────────────

export interface Classified {
  q: CandidateQuestion;
  h: QuestionHistory | undefined;
  unseen: boolean;
  due: boolean;
  overdueDays: number;
  struggling: boolean;
  recent: boolean;
  weakTopic: boolean;
  topicWeakness: number; // 0 (strong) … 1 (weak)
  mastered: boolean;
  daysSinceSeen: number;
}

/** Laplace-smoothed accuracy so one lucky answer does not make a topic "strong". */
export function smoothedAccuracy(p: TopicPerformance): number {
  return (p.correct + 1) / (p.attempts + 2);
}

/**
 * Weak topics: enough data and below the accuracy bar. If nothing is below the bar,
 * the bottom third of topics with data still count, so "Review Weak Topics" always
 * has something to say once the user has history.
 */
export function findWeakTopics(perf: ReadonlyMap<string, TopicPerformance>): Map<string, number> {
  const withData = [...perf.entries()].filter(([, p]) => p.attempts >= SELECTION_DEFAULTS.weakMinAttempts);
  const weakness = new Map<string, number>();
  if (withData.length === 0) return weakness;

  for (const [topicId, p] of withData) {
    const acc = smoothedAccuracy(p);
    if (acc < SELECTION_DEFAULTS.weakAccuracy) weakness.set(topicId, 1 - acc);
  }
  if (weakness.size === 0 && withData.length >= 2) {
    const sorted = withData.sort((a, b) => smoothedAccuracy(a[1]) - smoothedAccuracy(b[1]));
    const take = Math.max(1, Math.floor(sorted.length / 3));
    for (const [topicId, p] of sorted.slice(0, take)) weakness.set(topicId, (1 - smoothedAccuracy(p)) * 0.5);
  }
  return weakness;
}

/** Topic performance derived from per-question history (used when no explicit stats are passed). */
export function topicPerformanceFrom(
  candidates: readonly CandidateQuestion[],
  history: ReadonlyMap<string, QuestionHistory>,
): Map<string, TopicPerformance> {
  const perf = new Map<string, TopicPerformance>();
  for (const q of candidates) {
    const h = history.get(q.id);
    if (!h) continue;
    const graded = h.timesCorrect + h.timesIncorrect;
    if (graded === 0) continue;
    const p = perf.get(q.topicId) ?? { attempts: 0, correct: 0 };
    p.attempts += graded;
    p.correct += h.timesCorrect;
    perf.set(q.topicId, p);
  }
  return perf;
}

export function classify(
  q: CandidateQuestion,
  h: QuestionHistory | undefined,
  now: Date,
  recentWindowHours: number,
  weakTopics: ReadonlyMap<string, number>,
): Classified {
  const unseen = !h || h.timesSeen === 0;
  const due = !!h?.nextReviewAt && h.nextReviewAt.getTime() <= now.getTime();
  const overdueDays = due && h?.nextReviewAt ? (now.getTime() - h.nextReviewAt.getTime()) / DAY_MS : 0;
  const graded = h ? h.timesCorrect + h.timesIncorrect : 0;
  const struggling =
    !!h && (h.lastCorrect === false || (graded >= 2 && h.timesIncorrect / graded > 0.4 && h.consecutiveCorrect < 2));
  const recent =
    !!h?.lastSeenAt && recentWindowHours > 0 && now.getTime() - h.lastSeenAt.getTime() < recentWindowHours * HOUR_MS;
  const daysSinceSeen = h?.lastSeenAt ? (now.getTime() - h.lastSeenAt.getTime()) / DAY_MS : Infinity;
  const topicWeakness = weakTopics.get(q.topicId) ?? 0;
  return {
    q,
    h,
    unseen,
    due,
    overdueDays,
    struggling,
    recent,
    weakTopic: weakTopics.has(q.topicId),
    topicWeakness,
    mastered: !!h && !due && h.consecutiveCorrect >= SELECTION_DEFAULTS.masteredStreak,
    daysSinceSeen,
  };
}

// ───────────────────────── Scoring ─────────────────────────

/** Primary reason, in priority order. */
export function reasonFor(c: Classified): SelectionReason {
  if (c.struggling) return "incorrect";
  if (c.due) return "due";
  if (c.unseen) return "new";
  if (c.weakTopic) return "weak-topic";
  return "fresh";
}

const staleness = (days: number) => (Number.isFinite(days) ? Math.min(3, 1 + days / 7) : 3);

/** Mode-specific sampling weight. 0 means "never pick in this mode". */
export function weightFor(c: Classified, mode: SelectionMode): number {
  const overdueBoost = 1 + Math.min(2, c.overdueDays / 3);
  switch (mode) {
    case "NEW":
      // Unseen first; otherwise the longest-unseen, still nudging toward struggling items.
      if (c.unseen) return 10;
      return staleness(c.daysSinceSeen) * (c.struggling ? 1.5 : 1) * (c.mastered ? 0.5 : 1);

    case "WEAK": {
      let w = 0.3;
      if (c.struggling) w += 8;
      if (c.due) w += 5 * overdueBoost;
      if (c.weakTopic) w += 1 + 6 * c.topicWeakness;
      if (c.unseen && c.weakTopic) w += 2; // fill gaps in weak topics with new material
      if (c.mastered) w *= 0.25;
      return w;
    }

    case "MIXED": {
      let w = 1;
      if (c.unseen) w += 3;
      if (c.struggling) w += 5;
      if (c.due) w += 4 * overdueBoost;
      if (c.weakTopic) w += 3 * c.topicWeakness;
      if (c.mastered) w *= 0.4;
      return w;
    }
  }
}

// ───────────────────────── Selection ─────────────────────────

export function selectQuestions(
  candidates: readonly CandidateQuestion[],
  history: ReadonlyMap<string, QuestionHistory>,
  options: SelectionOptions,
  topicPerf?: ReadonlyMap<string, TopicPerformance>,
): SelectionResult {
  const rng = createRng(options.seed);
  const recentWindowHours = options.recentWindowHours ?? SELECTION_DEFAULTS.recentWindowHours;
  const count = Math.max(0, Math.floor(options.count));

  // De-duplicate the pool defensively (a question may match several filters).
  const pool = [...new Map(candidates.map((q) => [q.id, q])).values()];
  const weakTopics = findWeakTopics(topicPerf ?? topicPerformanceFrom(pool, history));
  const classified = pool.map((q) => classify(q, history.get(q.id), options.now, recentWindowHours, weakTopics));

  const fresh = classified.filter((c) => !c.recent);
  const recent = classified.filter((c) => c.recent);

  const distinctTopics = new Set(pool.map((q) => q.topicId)).size;
  const share = options.maxTopicShare ?? SELECTION_DEFAULTS.maxTopicShare;
  const topicCap = distinctTopics > 1 ? Math.max(2, Math.ceil(count * share)) : Infinity;

  const chosen: Classified[] = [];
  const chosenIds = new Set<string>();
  const topicCounts = new Map<string, number>();

  const take = (items: Classified[], k: number, weight: (c: Classified) => number, capped: boolean) => {
    if (k <= 0) return;
    const available = items.filter((c) => !chosenIds.has(c.q.id));
    const picked = weightedSample(available, weight, k, rng, (c, pickedSoFar) => {
      if (!capped) return true;
      const inThisPass = pickedSoFar.filter((p) => p.q.topicId === c.q.topicId).length;
      return (topicCounts.get(c.q.topicId) ?? 0) + inThisPass < topicCap;
    });
    for (const c of picked) {
      chosen.push(c);
      chosenIds.add(c.q.id);
      topicCounts.set(c.q.topicId, (topicCounts.get(c.q.topicId) ?? 0) + 1);
    }
  };
  const remaining = () => count - chosen.length;
  const modeWeight = (c: Classified) => weightFor(c, options.mode);

  // Priority tiers inside the fresh pool. Each tier is filled by weighted random sampling,
  // so the *kind* of question is guaranteed while the *specific* questions still vary.
  const isReview = (c: Classified) => c.due || c.struggling;
  if (options.mode === "NEW") {
    take(fresh.filter((c) => c.unseen), remaining(), modeWeight, true);
  } else if (options.mode === "WEAK") {
    take(fresh.filter(isReview), remaining(), modeWeight, true);
    take(fresh.filter((c) => c.weakTopic && !c.mastered), remaining(), modeWeight, true);
  } else {
    // MIXED: explicit quotas so a mixed session really is mixed; unused quota rolls over below.
    const quotas = options.mixedQuotas ?? SELECTION_DEFAULTS.mixedQuotas;
    const reviewK = Math.round(count * quotas.review);
    const weakK = Math.round(count * quotas.weak);
    const newK = Math.max(0, count - reviewK - weakK);
    take(fresh.filter(isReview), reviewK, modeWeight, true);
    take(fresh.filter((c) => c.weakTopic && !c.mastered), weakK, modeWeight, true);
    take(fresh.filter((c) => c.unseen), newK, modeWeight, true);
  }

  // Remaining fresh questions (with topic cap), then without the cap, then the recent fallback tier.
  take(fresh, remaining(), modeWeight, true);
  take(fresh, remaining(), (c) => Math.max(modeWeight(c), 0.05), false);

  let usedRecentFallback = false;
  if (remaining() > 0 && recent.length > 0) {
    usedRecentFallback = true;
    // Among recent questions prefer the ones seen longest ago, and still prefer mistakes.
    const recentWeight = (c: Classified) => {
      const hoursAgo = c.h?.lastSeenAt ? (options.now.getTime() - c.h.lastSeenAt.getTime()) / HOUR_MS : 0;
      return (1 + hoursAgo) * (c.struggling ? 2 : 1);
    };
    take(recent, remaining(), recentWeight, false);
  }

  const byReason: Record<SelectionReason, number> = {
    due: 0,
    incorrect: 0,
    "weak-topic": 0,
    new: 0,
    fresh: 0,
    fallback: 0,
  };
  const picks: Pick[] = shuffle(chosen, rng).map((c) => {
    const reason: SelectionReason = c.recent ? "fallback" : reasonFor(c);
    byReason[reason]++;
    return { questionId: c.q.id, topicId: c.q.topicId, reason, weight: Math.round(modeWeight(c) * 100) / 100 };
  });

  return {
    picks,
    diagnostics: {
      poolSize: pool.length,
      freshPoolSize: fresh.length,
      usedRecentFallback,
      weakTopicIds: [...weakTopics.keys()],
      byReason,
      shortfall: Math.max(0, count - picks.length),
    },
  };
}

// ───────────────────────── Quiz composition ─────────────────────────

export interface ComposableQuestion extends CandidateQuestion {
  optionIds: string[];
}

export interface QuizSlot {
  questionId: string;
  position: number;
  optionOrder: string[];
  reason: SelectionReason;
}

/**
 * Select questions and give each one a freshly shuffled option order.
 * When an option list has ≥3 entries we avoid reproducing the authored order, so the
 * correct answer is not always where the author happened to put it.
 */
export function composeQuiz(
  candidates: readonly ComposableQuestion[],
  history: ReadonlyMap<string, QuestionHistory>,
  options: SelectionOptions,
  topicPerf?: ReadonlyMap<string, TopicPerformance>,
): { slots: QuizSlot[]; diagnostics: SelectionResult["diagnostics"] } {
  const result = selectQuestions(candidates, history, options, topicPerf);
  const byId = new Map(candidates.map((q) => [q.id, q]));
  // Separate stream for option shuffles so changing the pool does not perturb option order logic.
  const optionRng = createRng((options.seed ^ 0x9e3779b9) >>> 0);
  const slots = result.picks.map((p, position) => ({
    questionId: p.questionId,
    position,
    optionOrder: shuffleOptions(byId.get(p.questionId)?.optionIds ?? [], optionRng),
    reason: p.reason,
  }));
  return { slots, diagnostics: result.diagnostics };
}

export function shuffleOptions(optionIds: readonly string[], rng: Rng): string[] {
  if (optionIds.length < 2) return [...optionIds];
  let out = shuffle(optionIds, rng);
  for (let tries = 0; tries < 3 && optionIds.length >= 3 && out.every((id, i) => id === optionIds[i]); tries++) {
    out = shuffle(optionIds, rng);
  }
  return out;
}
