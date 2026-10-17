import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { getLessonRecommendations } from "@/server/services/learn.service";

export const GET = route(async () => {
  const user = await requireUser();
  return { items: await getLessonRecommendations(user.id) };
});
