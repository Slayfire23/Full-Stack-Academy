import { route, parseBody, http } from "@/server/http";
import { requireUser } from "@/server/session";
import { lessonPracticeAnswerSchema, idSchema } from "@/lib/validation/schemas";
import { recordLessonPractice } from "@/server/services/learn.service";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Lesson");
  const input = await parseBody(req, lessonPracticeAnswerSchema);
  return recordLessonPractice(user.id, params.id, input);
});
