import { route, parseQuery } from "@/server/http";
import { requireUser } from "@/server/session";
import { flashcardQueueQuerySchema } from "@/lib/validation/schemas";
import { buildQueue, dueSummary } from "@/server/services/flashcard.service";

/** Due cards (most overdue first) interleaved with a capped number of new cards. */
export const GET = route(async (req) => {
  const user = await requireUser();
  const q = parseQuery(req, flashcardQueueQuerySchema);
  const [cards, summary] = await Promise.all([buildQueue(user.id, q), dueSummary(user.id)]);
  return { cards, ...summary };
});
