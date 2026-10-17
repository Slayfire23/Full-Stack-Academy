import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { paginationSchema } from "@/lib/validation/schemas";
import { listGenerated } from "@/server/services/generation.service";

const query = paginationSchema.extend({ status: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional() });

export const GET = route(async (req) => {
  await requireAdmin();
  const q = parseQuery(req, query);
  return listGenerated(q.status, q.cursor, q.limit);
});
