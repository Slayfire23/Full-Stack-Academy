import { NextResponse } from "next/server";
import { route, parseBody, http } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { lessonPrerequisiteSchema, idSchema } from "@/lib/validation/schemas";
import { lessons } from "@/server/services/admin.service";

export const POST = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Lesson");
  const { prerequisiteId } = await parseBody(req, lessonPrerequisiteSchema);
  const item = await lessons.addPrerequisite(params.id, prerequisiteId);
  return NextResponse.json({ item }, { status: 201 });
});
