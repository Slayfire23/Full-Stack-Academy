import { NextResponse } from "next/server";
import { route, parseBody, parseQuery } from "@/server/http";
import { requireUser } from "@/server/session";
import { createInterviewSchema, paginationSchema } from "@/lib/validation/schemas";
import { createInterview, listInterviews } from "@/server/services/interview.service";

export const POST = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, createInterviewSchema);
  return NextResponse.json(await createInterview(user.id, input), { status: 201 });
});

export const GET = route(async (req) => {
  const user = await requireUser();
  const { cursor, limit } = parseQuery(req, paginationSchema);
  return listInterviews(user.id, cursor, limit);
});
