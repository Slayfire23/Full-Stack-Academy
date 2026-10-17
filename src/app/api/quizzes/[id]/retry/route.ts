import { NextResponse } from "next/server";
import { route, parseBody, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { idSchema, retryQuizSchema } from "@/lib/validation/schemas";
import { retryQuiz } from "@/server/services/quiz.service";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Quiz");
  const { scope } = await parseBody(req, retryQuizSchema);
  return NextResponse.json(await retryQuiz(user.id, params.id, scope), { status: 201 });
});
