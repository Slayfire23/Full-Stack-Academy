import { route, parseBody, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { flashcardSessionUpdateSchema, idSchema } from "@/lib/validation/schemas";
import { updateSession } from "@/server/services/flashcard.service";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Study session");
  const input = await parseBody(req, flashcardSessionUpdateSchema);
  return updateSession(user.id, params.id, input);
});
