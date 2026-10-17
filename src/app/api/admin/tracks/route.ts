import { NextResponse } from "next/server";
import { route, parseBody } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { trackSchema } from "@/lib/validation/schemas";
import { tracks } from "@/server/services/admin.service";

export const GET = route(async (_req) => {
  await requireAdmin();
  return { items: await tracks.list() };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const input = await parseBody(req, trackSchema);
  return NextResponse.json({ item: await tracks.create(input) }, { status: 201 });
});
