import { route, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { idSchema } from "@/lib/validation/schemas";
import { getTopic } from "@/server/services/content.service";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Topic");
  const topic = await getTopic(user.id, params.id);
  return { lessons: topic.lessons };
});
