import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { requireUser } from "@/server/session";
import { listTopics } from "@/server/services/content.service";

const query = z.object({ track: z.string().regex(/^[a-z0-9-]+$/).max(60).default("backend") });

export const GET = route(async (req) => {
  await requireUser();
  const { track } = parseQuery(req, query);
  return { topics: await listTopics(track) };
});
