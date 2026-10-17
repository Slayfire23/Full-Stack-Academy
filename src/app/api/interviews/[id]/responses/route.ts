import { route, parseBody, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { enforce, limiters } from "@/server/limits";
import { idSchema, interviewResponseSchema } from "@/lib/validation/schemas";
import { saveResponse } from "@/server/services/interview.service";

/** Save (or revise) a written answer; reveals the model answer and rubric. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  enforce(limiters.writes, user.id);
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Interview session");
  const input = await parseBody(req, interviewResponseSchema);
  return { session: await saveResponse(user.id, params.id, input) };
});
