"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  BarChart3,
  BookOpen,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tracks", label: "Learning tracks", icon: BookOpen },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/quizzes", label: "Quizzes", icon: ListChecks },
  { href: "/interview", label: "Interview practice", icon: MessagesSquare },
  { href: "/review", label: "Review queue", icon: RotateCcw, showDue: true },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text"
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      {dark ? "Light theme" : "Dark theme"}
    </button>
  );
}

function NavLinks({ due, isAdmin, onNavigate }: { due: number; isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV, { href: "/admin", label: "Admin", icon: ShieldCheck }] : NAV;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {"showDue" in item && item.showDue && due > 0 ? (
                <span className="rounded-md bg-accent px-1.5 text-xs font-semibold text-accent-ink" aria-label={`${due} due`}>
                  {due > 99 ? "99+" : due}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Shell({
  user,
  due,
  logout,
  children,
}: {
  user: { name: string; role: "USER" | "ADMIN" };
  due: number;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const footer = (
    <div className="flex flex-col gap-0.5 border-t border-border pt-3">
      <ThemeToggle />
      <form action={logout}>
        <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
          <LogOut className="size-4" aria-hidden /> Sign out
        </button>
      </form>
      <p className="truncate px-3 pt-2 text-xs text-muted">Signed in as {user.name}</p>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface px-3 py-5 lg:flex">
        <Link href="/dashboard" className="px-3 text-base font-semibold tracking-tight">Full-Stack Academy</Link>
        <nav aria-label="Main" className="flex-1 overflow-y-auto">
          <NavLinks due={due} isAdmin={user.role === "ADMIN"} />
        </nav>
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="font-semibold">Full-Stack Academy</Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="rounded-lg p-2 text-muted hover:bg-surface-2"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </header>
      {open ? (
        <div id="mobile-nav" className="fixed inset-x-0 top-14 z-20 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-border bg-surface p-3 lg:hidden">
          <nav aria-label="Main"><NavLinks due={due} isAdmin={user.role === "ADMIN"} onNavigate={() => setOpen(false)} /></nav>
          <div className="mt-3">{footer}</div>
        </div>
      ) : null}

      <main id="main" className="min-w-0 px-4 py-6 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
