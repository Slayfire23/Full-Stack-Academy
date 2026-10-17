import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { generationStatus } from "@/server/services/generation.service";
import { Card, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const [questions, unpublished, pending, users, byType] = await Promise.all([
    prisma.question.count({ where: { ownerId: null, published: true } }),
    prisma.question.count({ where: { ownerId: null, published: false } }),
    prisma.generatedQuestion.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.user.count(),
    prisma.question.groupBy({ by: ["type"], where: { ownerId: null, published: true }, _count: { _all: true } }),
  ]);
  const ai = generationStatus();
  return (
    <>
      <PageHeader title="Content administration" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5"><p className="text-sm text-muted">Published questions</p><p className="mt-1 text-2xl font-semibold">{questions}</p><p className="text-xs text-muted">{unpublished} unpublished</p></Card>
        <Link href="/admin/generated?status=PENDING_REVIEW"><Card className="h-full p-5 hover:border-accent"><p className="text-sm text-muted">AI drafts awaiting review</p><p className="mt-1 text-2xl font-semibold text-accent">{pending}</p></Card></Link>
        <Card className="p-5"><p className="text-sm text-muted">Accounts</p><p className="mt-1 text-2xl font-semibold">{users}</p></Card>
        <Card className="p-5">
          <p className="text-sm text-muted">AI generation</p>
          <p className="mt-1 font-semibold">{ai.aiConfigured ? "Configured" : "Not configured"}</p>
          <p className="text-xs text-muted">{ai.aiConfigured ? (ai.autoPublish ? "Validated drafts publish automatically" : "Drafts need approval") : "Set AI_API_KEY to enable"}</p>
        </Card>
      </div>
      <Card className="mt-4 p-6">
        <h2 className="font-semibold">Bank by question type</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {byType.map((t) => <li key={t.type} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2"><span>{t.type}</span><span className="tabular-nums">{t._count._all}</span></li>)}
        </ul>
      </Card>
    </>
  );
}
