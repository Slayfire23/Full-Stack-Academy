import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { dashboard } from "@/server/services/analytics.service";
import { Card, EmptyState, Meter, PageHeader } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { ActivityChart, ForecastChart } from "@/components/charts";

export const metadata: Metadata = { title: "Dashboard" };

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = await dashboard(user.id);
  const rec = d.recommendation;

  return (
    <>
      <PageHeader
        title={d.isNewUser ? "Welcome to Full-Stack Academy" : "Today"}
        description={
          d.isNewUser
            ? "Nothing to review yet. Start with a short quiz or a flashcard session and your schedule builds itself."
            : `${d.answeredToday} of ${d.dailyGoal} answers toward today's goal.`
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* The primary action: what to do right now */}
        <Card className="p-6 lg:col-span-2">
          {d.dueNow > 0 ? (
            <>
              <p className="text-5xl font-semibold tracking-tight text-accent">{d.dueNow}</p>
              <p className="mt-1 text-lg">card{d.dueNow === 1 ? " is" : "s are"} due for review</p>
              <p className="mt-2 max-w-prose text-sm text-muted">
                Reviewing now, just before you would forget, is what moves cards to longer intervals.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/flashcards?start=1" className={buttonClasses("primary", "lg")}>Review due cards</Link>
                <Link href="/quizzes/new?mode=MIXED" className={buttonClasses("secondary", "lg")}>Mixed quiz</Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold">{d.isNewUser ? "Start your first session" : "Nothing due right now"}</p>
              <p className="mt-2 max-w-prose text-sm text-muted">
                {d.isNewUser
                  ? "New Questions mode serves material you have never seen. Every answer is scheduled for review automatically."
                  : "You are caught up. Learn something new or drill your weakest topics."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/quizzes/new?mode=NEW" className={buttonClasses("primary", "lg")}>New questions quiz</Link>
                <Link href="/flashcards?start=1" className={buttonClasses("secondary", "lg")}>Study flashcards</Link>
              </div>
            </>
          )}
          {!d.isNewUser ? (
            <div className="mt-6 max-w-md">
              <Meter value={d.answeredToday} max={d.dailyGoal} label="Daily goal progress" tone="good" />
            </div>
          ) : null}
        </Card>

        <Card className="flex flex-col p-6">
          <h2 className="font-semibold">Recommended next</h2>
          {rec ? (
            <>
              <p className="mt-3 text-lg">{rec.title}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {rec.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <Link href={`/quizzes/new?mode=${rec.basis === "history" ? "WEAK" : "NEW"}&topic=${rec.topicId}`} className={buttonClasses("secondary", "sm")}>
                  Quiz this topic
                </Link>
                <Link href={`/topics/${rec.topicId}`} className={buttonClasses("ghost", "sm")}>Read the lesson</Link>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">No topics are published yet.</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Answered" value={String(d.questionsAnswered)} />
        <Stat label="Accuracy" value={pct(d.accuracy)} hint={d.accuracy === null ? "Appears after your first graded answer" : `${d.gradedAnswers} graded answers`} />
        <Stat label="Study streak" value={`${d.streak.current} day${d.streak.current === 1 ? "" : "s"}`} hint={`Longest: ${d.streak.longest}`} />
        <Stat label="Study time" value={`${d.studyMinutes} min`} hint="Across flashcards, quizzes and interviews" />
      </div>

      {d.isNewUser ? (
        <div className="mt-4">
          <EmptyState title="Your charts will appear here">
            Accuracy over time, weakest topics and your review forecast are calculated from your own answers — there is nothing to show until you have some.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <h2 className="mb-4 font-semibold">Last 30 days</h2>
            <ActivityChart series={d.series} />
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 font-semibold">Reviews coming up</h2>
            <ForecastChart counts={d.forecast} />
            <p className="mt-3 text-xs text-muted">Next 14 days. Today includes overdue cards.</p>
          </Card>
          <Card className="p-6 lg:col-span-3">
            <div className="grid gap-6 md:grid-cols-2">
              <TopicList title="Weakest topics" items={d.weakestTopics} tone="bad" empty="Answer at least 3 questions in a topic to rank it." />
              <TopicList title="Strongest topics" items={d.strongestTopics} tone="good" empty="Keep going — strengths show up once you have a few topics ranked." />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

function TopicList({ title, items, tone, empty }: { title: string; items: { topicId: string; title: string; accuracy: number; attempts: number }[]; tone: "good" | "bad"; empty: string }) {
  return (
    <div>
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((t) => (
            <li key={t.topicId}>
              <div className="flex justify-between gap-3 text-sm">
                <Link href={`/topics/${t.topicId}`} className="hover:underline">{t.title}</Link>
                <span className={tone === "good" ? "text-good" : "text-bad"}>{Math.round(t.accuracy * 100)}%</span>
              </div>
              <p className="text-xs text-muted">{t.attempts} answers</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
