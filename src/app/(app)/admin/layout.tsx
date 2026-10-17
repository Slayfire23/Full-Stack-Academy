import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/session";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/generated", label: "AI drafts" },
  { href: "/admin/curriculum", label: "Curriculum" },
];

/** Server-side guard: non-admins get a 404 (the admin area's existence is not advertised). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") notFound();
  return (
    <>
      <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-1 border-b border-border pb-3">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text">{t.label}</Link>
        ))}
      </nav>
      {children}
    </>
  );
}
