import type { Metadata } from "next";
import Link from "next/link";
import { listAdminQuestions } from "@/server/services/admin.service";
import { listTopics } from "@/server/services/content.service";
import { requireAdminPage } from "@/server/session";
import { Badge, Card, Input, PageHeader, Select, typeLabel } from "@/components/ui/primitives";
import { Button, buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Questions — Admin" };

export default async function AdminQuestions({ searchParams }: { searchParams: Promise<{ topicId?: string; q?: string; cursor?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const [topics, { items, nextCursor }] = await Promise.all([
    listTopics(),
    listAdminQuestions({ topicId: sp.topicId || undefined, q: sp.q || undefined, cursor: sp.cursor, limit: 30 }),
  ]);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(sp.topicId ? { topicId: sp.topicId } : {}), ...(sp.q ? { q: sp.q } : {}), ...extra }).toString();
  return (
    <>
      <PageHeader title="Questions" actions={<Link href="/admin/questions/new" className={buttonClasses("primary")}>New question</Link>} />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <Select name="topicId" defaultValue={sp.topicId ?? ""} className="w-64" aria-label="Topic">
          <option value="">All topics</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </Select>
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search prompts" className="w-64" aria-label="Search prompts" />
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Card className="divide-y divide-border">
        {items.map((q) => (
          <Link key={q.id} href={`/admin/questions/${q.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2">
            <span className="min-w-0 flex-1 truncate">{q.prompt}</span>
            <Badge>{q.topic.title}</Badge>
            <Badge>{typeLabel(q.type)}</Badge>
            {q.source === "AI_GENERATED" ? <Badge tone="accent">AI</Badge> : null}
            {!q.published ? <Badge tone="bad">Unpublished</Badge> : null}
            <span className="w-20 text-right text-xs text-muted">{q._count.attempts} answers</span>
          </Link>
        ))}
      </Card>
      {nextCursor ? <div className="mt-4"><Link href={`/admin/questions?${qs({ cursor: nextCursor })}`} className={buttonClasses("secondary")}>More</Link></div> : null}
    </>
  );
}
