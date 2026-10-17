import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { prisma } from "@/server/db";
import { dueSummary } from "@/server/services/flashcard.service";
import { Shell } from "@/components/shell/nav";
import { logoutAction } from "../(auth)/actions";

// Every page under (app) is per-user and queries the database directly, often with no
// auth check of its own — they rely on this layout's redirect. During `next build`'s static-
// generation pass there is no session, and a child page's own data fetch can still fire
// before this layout's redirect takes effect, hitting the real database with no credentials.
// Forcing the whole tree dynamic (never statically prerendered) is correct anyway: nothing
// under here can be meaningfully pre-rendered without a signed-in user.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const [user, due] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: current.id }, select: { name: true, role: true } }),
    dueSummary(current.id),
  ]);
  return (
    <Shell user={user} due={due.due} logout={logoutAction}>
      {children}
    </Shell>
  );
}
