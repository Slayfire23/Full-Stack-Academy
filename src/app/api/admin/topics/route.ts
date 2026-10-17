import { NextResponse } from "next/server";
import { route, parseBody, parseQuery } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { topicSchema, idSchema } from "@/lib/validation/schemas";
import { topics } from "@/server/services/admin.service";
import { z } from "zod";
const query = z.object({ trackId: idSchema.optional() });

export const GET = route(async (req) => {
  await requireAdmin();
  const { trackId } = parseQuery(req, query);
  return { items: await topics.list(trackId) };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const input = await parseBody(req, topicSchema);
  return NextResponse.json({ item: await topics.create(input) }, { status: 201 });
});
