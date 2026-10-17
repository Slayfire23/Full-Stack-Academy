import Link from "next/link";
import { requireAdminPage } from "@/server/session";

// Every admin page queries the database directly, gated only by this layout's check below.
// Without this, `next build`'s static-generation pass would run those queries with no session.
export const dynamic = "force-dynamic";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/generated", label: "AI drafts" },
  { href: "/admin/curriculum", label: "Curriculum" },
];

/**
 * Server-side guard: non-admins get a 404 (the admin area's existence is not advertised).
 * src/middleware.ts blocks /admin/* for non-admins before any of this renders; this layout
 * and each page's own requireAdminPage() call are defense in depth, since layouts and pages
 * render in parallel and a page can reach the database before a layout's notFound() lands.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
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
