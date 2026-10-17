import type { Difficulty, Prisma, QuestionType } from "@prisma/client";
import { prisma } from "../db";
import type { AnswerData } from "@/lib/adaptive/question-schema";
import type { ComposableQuestion } from "@/lib/adaptive/selection";
import { optionIdsOf } from "@/lib/adaptive/grading";

/**
 * Which questions a user may see: published questions from published tracks, plus that
 * user's own private custom cards. Every query that serves questions to a learner uses this.
 */
export function visibleTo(userId: string): Prisma.QuestionWhereInput {
  return {
    OR: [
      { ownerId: null, published: true, topic: { track: { published: true } } },
      { ownerId: userId },
    ],
  };
}

export interface PoolFilter {
  userId: string;
  topicIds?: string[];
  difficulty?: Difficulty;
  types?: QuestionType[];
  bookmarkedOnly?: boolean;
  questionIds?: string[];
}

export function poolWhere(f: PoolFilter): Prisma.QuestionWhereInput {
  return {
    AND: [
      visibleTo(f.userId),
      f.topicIds?.length ? { topicId: { in: f.topicIds } } : {},
      f.difficulty ? { difficulty: f.difficulty } : {},
      f.types?.length ? { type: { in: f.types } } : {},
      f.bookmarkedOnly ? { bookmarks: { some: { userId: f.userId } } } : {},
      f.questionIds?.length ? { id: { in: f.questionIds } } : {},
    ],
  };
}

/** Lightweight candidate list for the selector (no prompts or explanations). */
export async function loadPool(f: PoolFilter): Promise<ComposableQuestion[]> {
  const rows = await prisma.question.findMany({
    where: poolWhere(f),
    select: { id: true, topicId: true, difficulty: true, type: true, answerData: true },
  });
  return rows.map((r) => ({
    id: r.id,
    topicId: r.topicId,
    difficulty: r.difficulty,
    type: r.type,
    optionIds: optionIdsOf(r.answerData as unknown as AnswerData),
  }));
}
