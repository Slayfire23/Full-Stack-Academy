import { route, parseBody } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { questionImportSchema } from "@/lib/validation/schemas";
import { importQuestions } from "@/server/services/admin.service";

/** Validated JSON import (up to 500 questions, 5 MB). Use { dryRun: true } to preview. */
export const POST = route(async (req) => {
  await requireAdmin();
  const input = await parseBody(req, questionImportSchema, 5_000_000);
  return importQuestions(input);
});
