import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "./db";
import { http } from "./http";

export interface CurrentUser {
  id: string;
  role: "USER" | "ADMIN";
}

/**
 * The authenticated user, re-checked against the database on every call. A JWT is valid until
 * it expires, so this lookup makes deleted accounts and role changes take effect immediately.
 * Never trust a user id that comes from the request body or URL for authorization.
 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw http.unauthorized();
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user) throw http.unauthorized("Your session is no longer valid — please sign in again");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw http.forbidden();
  return user;
}

/**
 * For admin page components specifically: 404s non-admins, same as the admin layout.
 * Defense in depth alongside the middleware and the layout — pages render in parallel with
 * their layout, so a page that queries the database on its own must not rely only on those.
 */
export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") notFound();
  return user;
}

/** For server components: the user or null, without throwing. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}
