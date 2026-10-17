import { NextResponse } from "next/server";
import { route, parseBody, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { enforce, limiters } from "@/server/limits";
import { idSchema, submitAnswerSchema } from "@/lib/validation/schemas";
import { submitAnswer } from "@/server/services/quiz.service";

/**
 * Submit one answer. Graded on the server. A repeated submission for the same question returns
 * the original result with 200 and `duplicate: true` instead of creating a second attempt.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  enforce(limiters.writes, user.id);
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Quiz");
  const input = await parseBody(req, submitAnswerSchema);
  const result = await submitAnswer(user.id, params.id, input);
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
});
