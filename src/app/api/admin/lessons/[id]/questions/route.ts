import { NextResponse } from "next/server";
import { route, parseBody, http } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { lessonQuestionLinkSchema, idSchema } from "@/lib/validation/schemas";
import { lessons } from "@/server/services/admin.service";

export const POST = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Lesson");
  const { questionId } = await parseBody(req, lessonQuestionLinkSchema);
  await lessons.linkQuestion(params.id, questionId);
  return new NextResponse(null, { status: 204 });
});
