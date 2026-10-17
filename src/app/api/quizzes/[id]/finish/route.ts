import { route, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { idSchema } from "@/lib/validation/schemas";
import { finishQuiz } from "@/server/services/quiz.service";

/** Idempotent. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Quiz");
  return finishQuiz(user.id, params.id);
});
