import { NextResponse } from "next/server";
import { route, parseBody, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { customFlashcardUpdateSchema, idSchema } from "@/lib/validation/schemas";
import { deleteCustomCard, updateCustomCard } from "@/server/services/flashcard.service";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Flashcard");
  const input = await parseBody(req, customFlashcardUpdateSchema);
  return updateCustomCard(user.id, params.id, input);
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Flashcard");
  await deleteCustomCard(user.id, params.id);
  return new NextResponse(null, { status: 204 });
});
