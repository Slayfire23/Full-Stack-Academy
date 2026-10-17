import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { listTracks } from "@/server/services/content.service";

export const GET = route(async () => {
  await requireUser();
  return { tracks: await listTracks() };
});
