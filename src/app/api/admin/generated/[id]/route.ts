import { route, parseBody, http } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { generationReviewSchema, idSchema } from "@/lib/validation/schemas";
import { approveGenerated, rejectGenerated } from "@/server/services/generation.service";

/** Approve (re-validates and re-checks duplicates first) or reject an AI draft. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Generated question");
  const input = await parseBody(req, generationReviewSchema);
  return input.action === "approve" ? approveGenerated(admin.id, params.id) : rejectGenerated(admin.id, params.id, input.reason);
});
