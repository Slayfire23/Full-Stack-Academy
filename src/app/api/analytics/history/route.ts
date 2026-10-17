import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { requireUser } from "@/server/session";
import { studyHistory } from "@/server/services/analytics.service";

const query = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });

export const GET = route(async (req) => {
  const user = await requireUser();
  const { days } = parseQuery(req, query);
  return studyHistory(user.id, days);
});
