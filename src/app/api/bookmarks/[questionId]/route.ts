import { route, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { idSchema } from "@/lib/validation/schemas";
import { removeBookmark } from "@/server/services/flashcard.service";

export const DELETE = route<{ questionId: string }>(async (_req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.questionId).success) throw http.notFound("Bookmark");
  return removeBookmark(user.id, params.questionId);
});
