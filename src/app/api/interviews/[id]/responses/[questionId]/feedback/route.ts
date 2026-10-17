import { route, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { idSchema } from "@/lib/validation/schemas";
import { requestAiFeedback } from "@/server/services/interview.service";

/** AI evaluation (503 when AI is not configured). Rate limited per user. */
export const POST = route<{ id: string; questionId: string }>(async (_req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success || !idSchema.safeParse(params.questionId).success) {
    throw http.notFound("Interview response");
  }
  return requestAiFeedback(user.id, params.id, params.questionId);
});
