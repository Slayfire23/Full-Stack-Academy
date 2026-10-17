/**
 * "Lessons to study": ranks not-yet-completed lessons by unresolved unfamiliar marks,
 * recent missed questions in the topic, low topic accuracy, and unmet prerequisites.
 * Pure: the service layer loads the signals, this ranks them.
 */
import type { Difficulty } from "@/lib/adaptive/question-schema";

const LEVEL_RANK: Record<Difficulty, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

export interface LessonCandidate {
  id: string;
  topicId: string;
  title: string;
  level: Difficulty;
  order: number;
  completed: boolean;
  locked: boolean;
  /** Ids of this lesson's prerequisites that are not yet completed. */
  missingPrerequisiteIds: readonly string[];
}

export interface RecommendationSignals {
  /** topicId -> count of this user's unresolved "haven't learned this" marks in that topic. */
  unresolvedUnfamiliarByTopic: ReadonlyMap<string, number>;
  /** topicId -> count of recently missed questions in that topic. */
  recentMissedByTopic: ReadonlyMap<string, number>;
  /** topicId -> accuracy in [0, 1]. Absent means not enough data. */
  topicAccuracy: ReadonlyMap<string, number>;
  /** True when the user has no study history at all. */
  isNewUser: boolean;
}

export interface Recommendation {
  lessonId: string;
  title: string;
  reason: string;
  score: number;
}

const WEAK_ACCURACY = 0.7;

function startingPoint(candidates: readonly LessonCandidate[]): Recommendation | undefined {
  const unlocked = candidates.filter((l) => !l.locked);
  const pool = unlocked.length > 0 ? unlocked : candidates;
  if (pool.length === 0) return undefined;
  const first = [...pool].sort(
    (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.order - b.order || a.title.localeCompare(b.title),
  )[0]!;
  return { lessonId: first.id, title: first.title, reason: "A good starting point", score: 0 };
}

export function recommendLessons(candidates: readonly LessonCandidate[], signals: RecommendationSignals, limit = 5): Recommendation[] {
  const notCompleted = candidates.filter((l) => !l.completed);
  if (notCompleted.length === 0) return [];
  if (signals.isNewUser) {
    const start = startingPoint(notCompleted);
    return start ? [start] : [];
  }

  const need = new Map<string, { score: number; reasons: string[] }>();
  for (const l of notCompleted) {
    const unresolved = signals.unresolvedUnfamiliarByTopic.get(l.topicId) ?? 0;
    const missed = signals.recentMissedByTopic.get(l.topicId) ?? 0;
    const accuracy = signals.topicAccuracy.get(l.topicId);
    const reasons: string[] = [];
    let score = 0;
    if (unresolved > 0) {
      score += unresolved * 3;
      reasons.push(`${unresolved} question${unresolved === 1 ? "" : "s"} marked "haven't learned this yet"`);
    }
    if (missed > 0) {
      score += missed * 2;
      reasons.push(`${missed} recently missed question${missed === 1 ? "" : "s"} in this topic`);
    }
    if (accuracy !== undefined && accuracy < WEAK_ACCURACY) {
      score += (WEAK_ACCURACY - accuracy) * 10;
      reasons.push(`topic accuracy is ${Math.round(accuracy * 100)}%`);
    }
    need.set(l.id, { score, reasons });
  }

  // A locked lesson's need is a reason to study its missing prerequisites, not the
  // locked lesson itself — recommending something the learner cannot start yet is useless.
  const byId = new Map(notCompleted.map((l) => [l.id, l]));
  for (const l of notCompleted) {
    if (!l.locked) continue;
    const own = need.get(l.id);
    if (!own || own.score <= 0) continue;
    for (const prereqId of l.missingPrerequisiteIds) {
      const target = need.get(prereqId);
      if (!target) continue; // already completed, or not a tracked candidate
      target.score += own.score * 0.5;
      target.reasons.push(`unlocks "${byId.get(l.id)?.title ?? l.title}"`);
    }
  }

  const ranked = notCompleted
    .filter((l) => !l.locked)
    .map((l) => {
      const n = need.get(l.id)!;
      return { lessonId: l.id, title: l.title, reason: n.reasons.join("; ") || "Not completed yet", score: n.score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 0) return ranked.slice(0, limit);
  const start = startingPoint(notCompleted);
  return start ? [start] : [];
}
