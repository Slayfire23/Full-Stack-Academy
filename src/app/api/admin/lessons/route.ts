import { NextResponse } from "next/server";
import { route, parseBody, parseQuery } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { lessonSchema, idSchema } from "@/lib/validation/schemas";
import { lessons } from "@/server/services/admin.service";
import { z } from "zod";
const query = z.object({ topicId: idSchema });

export const GET = route(async (req) => {
  await requireAdmin();
  const { topicId } = parseQuery(req, query);
  return { items: await lessons.list(topicId) };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const input = await parseBody(req, lessonSchema);
  return NextResponse.json({ item: await lessons.create(input) }, { status: 201 });
});
