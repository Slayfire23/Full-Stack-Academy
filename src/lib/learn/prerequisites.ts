/**
 * Lesson prerequisites: locking, cycle detection and beginner-to-advanced ordering.
 * Pure: takes plain data in, returns decisions. The database only supplies the edges.
 */
import type { Difficulty } from "@/lib/adaptive/question-schema";

export interface PrereqEdge {
  lessonId: string;
  prerequisiteId: string;
}

export interface LessonNode {
  id: string;
  title: string;
  level: Difficulty;
  order: number;
}

const LEVEL_RANK: Record<Difficulty, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

function byLevelThenOrder(a: LessonNode, b: LessonNode): number {
  return LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.order - b.order || a.title.localeCompare(b.title);
}

/** Is there a path from `fromId` to `toId` following existing "requires" edges? */
function hasPath(edges: readonly PrereqEdge[], fromId: string, toId: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) adj.set(e.lessonId, [...(adj.get(e.lessonId) ?? []), e.prerequisiteId]);
  const seen = new Set<string>();
  const stack = [fromId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === toId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return false;
}

/**
 * Would adding `newEdge` (lesson requires prerequisite) create a cycle? True for a
 * self-reference, or when the prerequisite already (transitively) requires the lesson.
 */
export function wouldCreateCycle(edges: readonly PrereqEdge[], newEdge: PrereqEdge): boolean {
  if (newEdge.lessonId === newEdge.prerequisiteId) return true;
  return hasPath(edges, newEdge.prerequisiteId, newEdge.lessonId);
}

export interface LockStatus {
  locked: boolean;
  /** Unmet prerequisites, in recommended study order. */
  missing: LessonNode[];
}

/** Locked lessons stay readable — this only flags "recommended to learn X first". */
export function computeLockStatus(
  lessons: readonly LessonNode[],
  edges: readonly PrereqEdge[],
  completedLessonIds: ReadonlySet<string>,
): Map<string, LockStatus> {
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const prereqsOf = new Map<string, string[]>();
  for (const e of edges) prereqsOf.set(e.lessonId, [...(prereqsOf.get(e.lessonId) ?? []), e.prerequisiteId]);

  const result = new Map<string, LockStatus>();
  for (const l of lessons) {
    const missing = (prereqsOf.get(l.id) ?? [])
      .filter((id) => !completedLessonIds.has(id))
      .map((id) => byId.get(id))
      .filter((x): x is LessonNode => x !== undefined)
      .sort(byLevelThenOrder);
    result.set(l.id, { locked: missing.length > 0, missing });
  }
  return result;
}

/**
 * Beginner-to-advanced order that still respects prerequisites: a lesson never appears
 * before any of its prerequisites, even if they share a level. Lessons involved in a
 * cycle (which `wouldCreateCycle` should have prevented at write time) are appended at
 * the end in level/order rather than dropped.
 */
export function orderLessons(lessons: readonly LessonNode[], edges: readonly PrereqEdge[]): LessonNode[] {
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const indegree = new Map<string, number>(lessons.map((l) => [l.id, 0]));
  const dependents = new Map<string, string[]>(); // prerequisiteId -> lessons that require it
  for (const e of edges) {
    if (!byId.has(e.lessonId) || !byId.has(e.prerequisiteId)) continue;
    indegree.set(e.lessonId, (indegree.get(e.lessonId) ?? 0) + 1);
    dependents.set(e.prerequisiteId, [...(dependents.get(e.prerequisiteId) ?? []), e.lessonId]);
  }

  const out: LessonNode[] = [];
  const queue = lessons.filter((l) => (indegree.get(l.id) ?? 0) === 0).sort(byLevelThenOrder);
  while (queue.length > 0) {
    queue.sort(byLevelThenOrder);
    const next = queue.shift()!;
    out.push(next);
    for (const depId of dependents.get(next.id) ?? []) {
      const remaining = (indegree.get(depId) ?? 0) - 1;
      indegree.set(depId, remaining);
      if (remaining === 0) queue.push(byId.get(depId)!);
    }
  }

  if (out.length < lessons.length) {
    const emitted = new Set(out.map((l) => l.id));
    out.push(...lessons.filter((l) => !emitted.has(l.id)).sort(byLevelThenOrder));
  }
  return out;
}
