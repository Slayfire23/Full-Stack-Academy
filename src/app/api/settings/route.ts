import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { settingsUpdateSchema } from "@/lib/validation/schemas";
import { getSettings, updateSettings } from "@/server/services/account.service";

export const GET = route(async () => {
  const user = await requireUser();
  return { settings: await getSettings(user.id) };
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, settingsUpdateSchema);
  return { settings: await updateSettings(user.id, input) };
});
