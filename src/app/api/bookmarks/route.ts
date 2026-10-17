import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { bookmarkSchema } from "@/lib/validation/schemas";
import { addBookmark, listBookmarks } from "@/server/services/flashcard.service";

export const GET = route(async () => {
  const user = await requireUser();
  return { bookmarks: await listBookmarks(user.id) };
});

/** Idempotent: bookmarking twice is fine. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { questionId } = await parseBody(req, bookmarkSchema);
  return addBookmark(user.id, questionId);
});
