import { NextResponse } from "next/server";
import { z } from "zod";
import { route, parseBody, parseQuery } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { idSchema, paginationSchema, questionInputSchema } from "@/lib/validation/schemas";
import { createQuestion, listAdminQuestions } from "@/server/services/admin.service";

const query = paginationSchema.extend({ topicId: idSchema.optional(), q: z.string().trim().max(100).optional() });

/** Admin listing includes answer keys. */
export const GET = route(async (req) => {
  await requireAdmin();
  return listAdminQuestions(parseQuery(req, query));
});

export const POST = route(async (req) => {
  await requireAdmin();
  const input = await parseBody(req, questionInputSchema);
  return NextResponse.json(await createQuestion(input), { status: 201 });
});
