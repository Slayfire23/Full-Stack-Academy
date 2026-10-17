import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { dashboard } from "@/server/services/analytics.service";

export const GET = route(async () => {
  const user = await requireUser();
  return { dashboard: await dashboard(user.id) };
});
