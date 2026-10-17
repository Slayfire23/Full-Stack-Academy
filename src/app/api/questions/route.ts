import { route, parseQuery } from "@/server/http";
import { requireUser } from "@/server/session";
import { questionListQuerySchema } from "@/lib/validation/schemas";
import { listQuestions } from "@/server/services/content.service";

/** Browse questions with filters and cursor pagination. Answer keys are never included. */
export const GET = route(async (req) => {
  const user = await requireUser();
  return listQuestions(user.id, parseQuery(req, questionListQuerySchema));
});
