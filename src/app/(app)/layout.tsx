import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { prisma } from "@/server/db";
import { dueSummary } from "@/server/services/flashcard.service";
import { Shell } from "@/components/shell/nav";
import { logoutAction } from "../(auth)/actions";

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
