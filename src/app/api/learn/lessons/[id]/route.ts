import { route, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { idSchema } from "@/lib/validation/schemas";
import { getLesson } from "@/server/services/learn.service";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Lesson");
  return getLesson(user.id, params.id);
});
