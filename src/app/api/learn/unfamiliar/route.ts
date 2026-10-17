import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { markUnfamiliarSchema } from "@/lib/validation/schemas";
import { markUnfamiliar } from "@/server/services/learn.service";

export const POST = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, markUnfamiliarSchema);
  return markUnfamiliar(user.id, input);
});
