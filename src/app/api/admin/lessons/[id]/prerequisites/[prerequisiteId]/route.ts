import { NextResponse } from "next/server";
import { route, http } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { idSchema } from "@/lib/validation/schemas";
import { lessons } from "@/server/services/admin.service";

export const DELETE = route<{ id: string; prerequisiteId: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success || !idSchema.safeParse(params.prerequisiteId).success) throw http.notFound("Lesson");
  await lessons.removePrerequisite(params.id, params.prerequisiteId);
  return new NextResponse(null, { status: 204 });
});
