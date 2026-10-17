import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { getTrack } from "@/server/services/content.service";

export const GET = route<{ slug: string }>(async (_req, { params }) => {
  const user = await requireUser();
  return { track: await getTrack(user.id, params.slug) };
});
