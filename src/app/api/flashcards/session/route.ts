import { NextResponse } from "next/server";
import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { flashcardSessionSchema } from "@/lib/validation/schemas";
import { getActiveSession, startSession } from "@/server/services/flashcard.service";

/** The unfinished session to resume, if any. */
export const GET = route(async () => {
  const user = await requireUser();
  return { session: await getActiveSession(user.id) };
});

/** Start a session — or resume the active one, so a double click never creates two. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, flashcardSessionSchema);
  const session = await startSession(user.id, input);
  return NextResponse.json({ session }, { status: session.resumed ? 200 : 201 });
});
