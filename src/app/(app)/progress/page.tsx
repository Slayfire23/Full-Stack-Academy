import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { dashboard } from "@/server/services/analytics.service";
import { Card, EmptyState, Meter, PageHeader } from "@/components/ui/primitives";
import { ActivityChart, ForecastChart } from "@/components/charts";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = await dashboard(user.id);

  if (d.isNewUser) {
    return (
      <>
        <PageHeader title="Progress" />
        <EmptyState title="No study history yet" action={<Link href="/quizzes/new?mode=NEW" className={buttonClasses("primary")}>Take a quiz</Link>}>
          Accuracy, topic strengths, streaks and your review forecast are calculated from real answers, so this page fills in as you study.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Progress" description={`${d.questionsAnswered} answers, ${d.studyMinutes} minutes of study, ${d.streak.current}-day streak (best ${d.streak.longest}).`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Answers per day</h2>
          <ActivityChart series={d.series} />
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">Coverage</h2>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{d.coverage.seen}<span className="text-base font-normal text-muted"> / {d.coverage.total} seen</span></p>
          <div className="mt-3"><Meter value={d.coverage.seen} max={d.coverage.total} label="Questions seen" tone="good" /></div>
          <p className="mt-3 text-sm text-muted">{d.coverage.mastered} mastered (3+ correct in a row).</p>
          <h2 className="mt-6 mb-3 font-semibold">Review forecast</h2>
          <ForecastChart counts={d.forecast} />
        </Card>
      </div>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold">Accuracy by topic</h2>
        <p className="mt-1 text-sm text-muted">Weakest first. Includes graded quiz answers and flashcard self-ratings.</p>
        {d.topicStats.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No graded answers yet.</p>
        ) : (
          <ul className="mt-5 grid gap-x-10 gap-y-4 md:grid-cols-2">
            {d.topicStats.map((t) => (
              <li key={t.topicId}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <Link href={`/topics/${t.topicId}`} className="hover:underline">{t.title}</Link>
                  <span className="tabular-nums text-muted">{Math.round(t.accuracy * 100)}% of {t.attempts}</span>
                </div>
                <Meter value={t.correct} max={t.attempts} label={`${t.title} accuracy`} tone={t.accuracy >= 0.7 ? "good" : "accent"} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {d.recentQuizzes.length > 0 ? (
        <Card className="mt-4 p-6">
          <h2 className="mb-3 font-semibold">Recent quizzes</h2>
          <ul className="divide-y divide-border">
            {d.recentQuizzes.map((q) => (
              <li key={q.id}>
                <Link href={`/quizzes/${q.id}/results`} className="flex justify-between gap-3 py-2.5 text-sm hover:underline">
                  <span>{q.completedAt?.toLocaleDateString()} — {q.questionCount} questions</span>
                  <span className="tabular-nums">{q.score === null ? "self-assessed" : `${Math.round(q.score)}%`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
