import { NextResponse } from "next/server";
import { route, parseBody, parseQuery } from "@/server/http";
import { requireUser } from "@/server/session";
import { enforce, limiters } from "@/server/limits";
import { createQuizSchema, paginationSchema } from "@/lib/validation/schemas";
import { createQuiz, listQuizzes } from "@/server/services/quiz.service";

/** Create a quiz with adaptive selection (NEW / WEAK / MIXED). Returns selection diagnostics. */
export const POST = route(async (req) => {
  const user = await requireUser();
  enforce(limiters.writes, user.id);
  const input = await parseBody(req, createQuizSchema);
  return NextResponse.json(await createQuiz(user.id, input), { status: 201 });
});

/** Quiz history, newest first. */
export const GET = route(async (req) => {
  const user = await requireUser();
  const { cursor, limit } = parseQuery(req, paginationSchema);
  return listQuizzes(user.id, cursor, limit);
});
