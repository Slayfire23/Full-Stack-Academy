/**
 * Spaced-repetition scheduler — a deterministic SM-2 variant with four ratings.
 *
 * Same inputs always produce the same outputs (no randomness, no "fuzz"), which keeps
 * the schedule testable and explainable. Documented in ARCHITECTURE.md § Scheduling.
 *
 *   AGAIN  forgot it         → relearn: due again in 10 minutes, repetitions reset, ease −0.20, lapse +1
 *   HARD   recalled, barely  → interval × 1.2 (min 1 day), ease −0.15
 *   GOOD   recalled          → 1 day, then 6 days, then interval × ease
 *   EASY   effortless        → 4 days, then interval × ease × 1.3, ease +0.15
 *
 * Ease is clamped to [1.3, 3.0]; intervals are whole days capped at 365.
 * Every successful review grows the interval by at least one day, so a card can never stall.
 */

export type Rating = "AGAIN" | "HARD" | "GOOD" | "EASY";
export const RATINGS: readonly Rating[] = ["AGAIN", "HARD", "GOOD", "EASY"] as const;

export interface SrsState {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
}

export interface SrsResult extends SrsState {
  nextReviewAt: Date;
}

export const SRS = {
  initialEase: 2.5,
  minEase: 1.3,
  maxEase: 3.0,
  maxIntervalDays: 365,
  relearnMinutes: 10,
  hardMultiplier: 1.2,
  easyBonus: 1.3,
  againEasePenalty: 0.2,
  hardEasePenalty: 0.15,
  easyEaseBonus: 0.15,
  graduatingIntervalDays: 1,
  secondIntervalDays: 6,
  easyFirstIntervalDays: 4,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function initialSrsState(): SrsState {
  return { repetitions: 0, intervalDays: 0, easeFactor: SRS.initialEase, lapses: 0 };
}

const clampEase = (e: number) => Math.min(SRS.maxEase, Math.max(SRS.minEase, round2(e)));
const clampInterval = (d: number) => Math.min(SRS.maxIntervalDays, Math.max(1, Math.round(d)));
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function scheduleReview(state: SrsState, rating: Rating, now: Date): SrsResult {
  const prev = { ...state, easeFactor: clampEase(state.easeFactor || SRS.initialEase) };

  if (rating === "AGAIN") {
    return {
      repetitions: 0,
      intervalDays: 0,
      easeFactor: clampEase(prev.easeFactor - SRS.againEasePenalty),
      lapses: prev.lapses + 1,
      nextReviewAt: new Date(now.getTime() + SRS.relearnMinutes * 60 * 1000),
    };
  }

  let interval: number;
  let ease = prev.easeFactor;

  if (rating === "HARD") {
    ease = clampEase(ease - SRS.hardEasePenalty);
    interval = prev.repetitions === 0 ? SRS.graduatingIntervalDays : prev.intervalDays * SRS.hardMultiplier;
  } else if (rating === "GOOD") {
    if (prev.repetitions === 0) interval = SRS.graduatingIntervalDays;
    else if (prev.repetitions === 1) interval = SRS.secondIntervalDays;
    else interval = prev.intervalDays * ease;
  } else {
    // EASY
    ease = clampEase(ease + SRS.easyEaseBonus);
    if (prev.repetitions === 0) interval = SRS.easyFirstIntervalDays;
    else interval = Math.max(prev.intervalDays, 1) * ease * SRS.easyBonus;
  }

  let intervalDays = clampInterval(interval);
  // Successful reviews must always move the card forward.
  if (prev.repetitions > 0 && intervalDays <= prev.intervalDays) {
    intervalDays = Math.min(SRS.maxIntervalDays, Math.round(prev.intervalDays) + 1);
  }

  return {
    repetitions: prev.repetitions + 1,
    intervalDays,
    easeFactor: ease,
    lapses: prev.lapses,
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}

/** Objective quiz answers map onto the same schedule. */
export function ratingFromCorrectness(correct: boolean): Rating {
  return correct ? "GOOD" : "AGAIN";
}

/** Self-rated flashcards: AGAIN means "did not recall"; anything else counts as recalled. */
export function correctnessFromRating(rating: Rating): boolean {
  return rating !== "AGAIN";
}

// ───────────────────────── Per-user progress ─────────────────────────

export interface ProgressRecord extends SrsState {
  timesSeen: number;
  timesCorrect: number;
  timesIncorrect: number;
  consecutiveCorrect: number;
  lastCorrect: boolean | null;
  lastRating: Rating | null;
  lastSeenAt: Date | null;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
}

export function emptyProgress(): ProgressRecord {
  return {
    ...initialSrsState(),
    timesSeen: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    consecutiveCorrect: 0,
    lastCorrect: null,
    lastRating: null,
    lastSeenAt: null,
    lastReviewedAt: null,
    nextReviewAt: null,
  };
}

export type AnswerOutcome =
  | { kind: "rated"; rating: Rating } // flashcard self-rating
  | { kind: "graded"; correct: boolean } // objective quiz answer
  | { kind: "ungraded" }; // open-ended answer without an objective verdict

/**
 * Pure state transition applied after every answer. Ungraded answers count as "seen"
 * (so recency avoidance works) but never move the review schedule — we do not pretend
 * to know whether an open-ended answer was right.
 */
export function applyOutcome(
  progress: ProgressRecord,
  outcome: AnswerOutcome,
  now: Date,
): { progress: ProgressRecord; rating: Rating | null } {
  const base: ProgressRecord = { ...progress, timesSeen: progress.timesSeen + 1, lastSeenAt: now };
  if (outcome.kind === "ungraded") return { progress: base, rating: null };

  const rating = outcome.kind === "rated" ? outcome.rating : ratingFromCorrectness(outcome.correct);
  const correct = outcome.kind === "rated" ? correctnessFromRating(outcome.rating) : outcome.correct;
  const srs = scheduleReview(progress, rating, now);

  return {
    rating,
    progress: {
      ...base,
      repetitions: srs.repetitions,
      intervalDays: srs.intervalDays,
      easeFactor: srs.easeFactor,
      lapses: srs.lapses,
      nextReviewAt: srs.nextReviewAt,
      lastReviewedAt: now,
      lastRating: rating,
      lastCorrect: correct,
      timesCorrect: progress.timesCorrect + (correct ? 1 : 0),
      timesIncorrect: progress.timesIncorrect + (correct ? 0 : 1),
      consecutiveCorrect: correct ? progress.consecutiveCorrect + 1 : 0,
    },
  };
}
