import { route, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { idSchema } from "@/lib/validation/schemas";
import { getQuizView } from "@/server/services/quiz.service";

/** The quiz in its per-quiz option order. Answer keys only for questions already answered with immediate feedback. */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Quiz");
  return { quiz: await getQuizView(user.id, params.id) };
});
