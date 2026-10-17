import { route, parseBody, parseQuery } from "@/server/http";
import { requireUser } from "@/server/session";
import { enforce, limiters } from "@/server/limits";
import { paginationSchema, reviewSchema } from "@/lib/validation/schemas";
import { review, reviewHistory } from "@/server/services/flashcard.service";

/** Record a rating (Again / Hard / Good / Easy). Replays with the same idempotencyKey are no-ops. */
export const POST = route(async (req) => {
  const user = await requireUser();
  enforce(limiters.writes, user.id);
  const input = await parseBody(req, reviewSchema);
  return review(user.id, input);
});

/** Review history, newest first. */
export const GET = route(async (req) => {
  const user = await requireUser();
  const { cursor, limit } = parseQuery(req, paginationSchema);
  return reviewHistory(user.id, cursor, limit);
});
