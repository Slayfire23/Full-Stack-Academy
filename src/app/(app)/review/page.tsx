import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { buildQueue, dueSummary, reviewHistory } from "@/server/services/flashcard.service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Review queue" };

const RATING_TONE = { AGAIN: "bad", HARD: "neutral", GOOD: "good", EASY: "good" } as const;

function relative(d: Date | null) {
  if (!d) return "new";
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins} min overdue`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h overdue`;
  return `${Math.round(hours / 24)} days overdue`;
}

export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [due, summary, history] = await Promise.all([
    buildQueue(user.id, { topicIds: [], bookmarkedOnly: false, incorrectOnly: false, includeNew: false, limit: 100, newLimit: 0 }),
    dueSummary(user.id),
    reviewHistory(user.id, undefined, 15),
  ]);
  return (
    <>
      <PageHeader
        title="Review queue"
        description={`${summary.due} due now, ${summary.dueWithin24h} more in the next 24 hours.`}
        actions={
          <>
            {summary.due > 0 ? <Link href="/flashcards?start=1" className={buttonClasses("primary")}>Review now</Link> : null}
            <Link href="/quizzes/new?mode=WEAK" className={buttonClasses("secondary")}>Weak-topic quiz</Link>
          </>
        }
      />
      {due.length === 0 ? (
        <EmptyState title="Nothing is due" action={<Link href="/quizzes/new?mode=NEW" className={buttonClasses("secondary")}>Learn something new</Link>}>
          Cards come back here when their review date arrives. Missed questions return within minutes; well-known ones can wait months.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-border">
          {due.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <p className="min-w-0 flex-1 truncate">{c.prompt}</p>
              <Badge>{c.topic.title}</Badge>
              {c.progress?.lastCorrect === false ? <Badge tone="bad">Missed</Badge> : null}
              <span className="w-32 text-right text-sm text-accent">{relative(c.progress?.nextReviewAt ?? null)}</span>
            </div>
          ))}
        </Card>
      )}
      {history.items.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Recent reviews</h2>
          <Card className="divide-y divide-border">
            {history.items.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <Badge tone={RATING_TONE[h.rating]}>{h.rating.toLowerCase()}</Badge>
                <span className="min-w-0 flex-1 truncate">{h.question.prompt}</span>
                <span className="text-muted">next in {h.newIntervalDays < 1 ? "10 min" : `${h.newIntervalDays} d`}</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
