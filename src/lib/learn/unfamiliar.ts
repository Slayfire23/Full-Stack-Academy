/**
 * "I haven't learned this yet": never counted as incorrect anywhere. Pure decisions only —
 * the service layer persists the mark and feeds the outcome through the normal recordOutcome
 * path (progress.service.ts) exactly like any other ungraded answer.
 */

export type UnfamiliarSource = "FLASHCARD" | "QUIZ" | "INTERVIEW";

/** Marking unfamiliar always yields an ungraded outcome: no accuracy hit, no SRS lapse,
 *  but the question is recorded as seen so the selector does not immediately re-serve it. */
export const UNFAMILIAR_OUTCOME = { kind: "ungraded" } as const;

export interface UnfamiliarMarkState {
  resolvedAt: Date | null;
}

export function isActiveMark(mark: UnfamiliarMarkState | null | undefined): boolean {
  return mark != null && mark.resolvedAt === null;
}

/** Completing a lesson resolves every unresolved mark linked to it, for that user. */
export function resolveMarksForLesson<T extends { id: string; lessonId: string | null; resolvedAt: Date | null }>(
  marks: readonly T[],
  lessonId: string,
): string[] {
  return marks.filter((m) => m.lessonId === lessonId && m.resolvedAt === null).map((m) => m.id);
}
