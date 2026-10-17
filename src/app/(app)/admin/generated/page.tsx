import type { Metadata } from "next";
import Link from "next/link";
import { listGenerated, generationStatus } from "@/server/services/generation.service";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { GeneratedReview, type GeneratedItem } from "@/components/admin/generated-review";

export const metadata: Metadata = { title: "AI drafts — Admin" };
const STATUSES = ["PENDING_REVIEW", "APPROVED", "REJECTED"] as const;

export default async function GeneratedPage({ searchParams }: { searchParams: Promise<{ status?: string; cursor?: string }> }) {
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof STATUSES)[number]) : "PENDING_REVIEW";
  const { items, nextCursor } = await listGenerated(status, sp.cursor, 20);
  const ai = generationStatus();
  return (
    <>
      <PageHeader title="AI-generated drafts" description="Nothing here is shown to learners until it is approved." />
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/generated?status=${s}`} className={buttonClasses(s === status ? "secondary" : "ghost", "sm")}>{s.replace("_", " ").toLowerCase()}</Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title="No drafts here">
          {ai.aiConfigured ? "Learners and admins can request variations from quiz results, and new scenarios from Interview practice." : "AI is not configured. Set AI_API_KEY (and optionally AI_BASE_URL, AI_MODEL) to enable generation; everything else works without it."}
        </EmptyState>
      ) : (
        <div className="space-y-4">{items.map((i) => <GeneratedReview key={i.id} item={i as GeneratedItem} />)}</div>
      )}
      {nextCursor ? <div className="mt-4"><Link href={`/admin/generated?status=${status}&cursor=${nextCursor}`} className={buttonClasses("secondary")}>More</Link></div> : null}
    </>
  );
}
