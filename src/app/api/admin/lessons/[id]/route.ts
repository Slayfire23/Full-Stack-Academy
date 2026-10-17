import { NextResponse } from "next/server";
import { route, parseBody, http } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { lessonUpdateSchema, idSchema } from "@/lib/validation/schemas";
import { lessons } from "@/server/services/admin.service";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Lesson");
  const input = await parseBody(req, lessonUpdateSchema);
  return { item: await lessons.update(params.id, input) };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Lesson");
  await lessons.remove(params.id);
  return new NextResponse(null, { status: 204 });
});
