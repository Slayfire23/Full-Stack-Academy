import { NextResponse } from "next/server";
import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { generationRequestSchema } from "@/lib/validation/schemas";
import { generationStatus, requestGeneration } from "@/server/services/generation.service";

/** Whether AI is configured (never reveals the key or model credentials). */
export const GET = route(async () => {
  await requireUser();
  return generationStatus();
});

/** Ask the AI for a question variation or a new interview scenario. Result is validated and queued. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, generationRequestSchema);
  return NextResponse.json(await requestGeneration(user.id, input), { status: 201 });
});
