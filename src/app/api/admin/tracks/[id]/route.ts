import { NextResponse } from "next/server";
import { route, parseBody, http } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { trackUpdateSchema, idSchema } from "@/lib/validation/schemas";
import { tracks } from "@/server/services/admin.service";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Track");
  const input = await parseBody(req, trackUpdateSchema);
  return { item: await tracks.update(params.id, input) };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Track");
  await tracks.remove(params.id);
  return new NextResponse(null, { status: 204 });
});
