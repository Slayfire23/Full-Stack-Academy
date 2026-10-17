import { route, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { idSchema } from "@/lib/validation/schemas";
import { viewLesson } from "@/server/services/learn.service";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Lesson");
  return { progress: await viewLesson(user.id, params.id) };
});
