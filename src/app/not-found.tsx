import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">That page does not exist</h1>
      <p className="text-muted">It may have been removed, or the link is mistyped. Your study progress is unaffected.</p>
      <Link href="/dashboard" className={buttonClasses("secondary", "md", "self-start")}>Go to dashboard</Link>
    </main>
  );
}
