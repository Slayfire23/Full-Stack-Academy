import { NextResponse } from "next/server";
import { route, parseBody, http } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { topicUpdateSchema, idSchema } from "@/lib/validation/schemas";
import { topics } from "@/server/services/admin.service";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Topic");
  const input = await parseBody(req, topicUpdateSchema);
  return { item: await topics.update(params.id, input) };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Topic");
  await topics.remove(params.id);
  return new NextResponse(null, { status: 204 });
});
