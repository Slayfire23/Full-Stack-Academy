import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { topicPerformance } from "@/server/services/analytics.service";

export const GET = route(async () => {
  const user = await requireUser();
  return topicPerformance(user.id);
});
