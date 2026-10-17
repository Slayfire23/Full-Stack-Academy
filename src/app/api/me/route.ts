import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { profileUpdateSchema } from "@/lib/validation/schemas";
import { deleteAccount, getProfile, updateProfile } from "@/server/services/account.service";

/** Session retrieval: the signed-in user's profile and settings. */
export const GET = route(async () => {
  const user = await requireUser();
  return { user: await getProfile(user.id) };
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, profileUpdateSchema);
  return { user: await updateProfile(user.id, input) };
});

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const { password } = await parseBody(req, z.object({ password: z.string().min(1).max(128) }));
  await deleteAccount(user.id, password);
  return { deleted: true };
});
