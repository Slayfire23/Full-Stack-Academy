import { NextResponse } from "next/server";
import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { enforce, limiters } from "@/server/limits";
import { customFlashcardSchema } from "@/lib/validation/schemas";
import { createCustomCard, listCustomCards } from "@/server/services/flashcard.service";

export const GET = route(async () => {
  const user = await requireUser();
  return { cards: await listCustomCards(user.id) };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  enforce(limiters.writes, user.id);
  const input = await parseBody(req, customFlashcardSchema);
  return NextResponse.json(await createCustomCard(user.id, input), { status: 201 });
});
