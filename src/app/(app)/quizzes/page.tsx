import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { listQuizzes } from "@/server/services/quiz.service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Quizzes" };
const MODE: Record<string, string> = { NEW: "New questions", WEAK: "Weak topics", MIXED: "Mixed" };

export default async function QuizzesPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { cursor } = await searchParams;
  const { items, nextCursor } = await listQuizzes(user.id, cursor, 20);
  return (
    <>
      <PageHeader title="Quizzes" description="Graded on the server, with every answer feeding your review schedule." actions={<Link href="/quizzes/new" className={buttonClasses("primary")}>New quiz</Link>} />
      {items.length === 0 ? (
        <EmptyState title="No quizzes yet" action={<Link href="/quizzes/new?mode=NEW" className={buttonClasses("primary")}>Take your first quiz</Link>}>
          A 10-question New Questions quiz takes about five minutes and seeds your review schedule.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-border">
          {items.map((q) => (
            <Link key={q.id} href={q.status === "IN_PROGRESS" ? `/quizzes/${q.id}` : `/quizzes/${q.id}/results`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-surface-2">
              <span className="w-40 text-sm text-muted">{q.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="flex-1 font-medium">{MODE[q.mode]} — {q.questionCount} questions</span>
              {q.status === "IN_PROGRESS" ? <Badge tone="accent">In progress</Badge> : q.score === null ? <Badge>Self-assessed</Badge> : <span className="text-lg font-semibold tabular-nums">{Math.round(q.score)}%</span>}
            </Link>
          ))}
        </Card>
      )}
      {nextCursor ? <div className="mt-4"><Link href={`/quizzes?cursor=${nextCursor}`} className={buttonClasses("secondary")}>Older quizzes</Link></div> : null}
    </>
  );
}
