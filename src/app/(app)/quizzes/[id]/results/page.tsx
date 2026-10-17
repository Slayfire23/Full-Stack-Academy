import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { getResults } from "@/server/services/quiz.service";
import { HttpError } from "@/server/http";
import { isAiConfigured } from "@/lib/ai/client";
import { Badge, Card, DifficultyBadge, Meter, PageHeader, typeLabel } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";
import { Feedback } from "@/components/quiz/runner";
import { GenerateVariationButton, RetryButtons } from "@/components/quiz/actions";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const r = await getResults(user.id, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    if (e instanceof HttpError && e.status === 409) redirect(`/quizzes/${id}`);
    throw e;
  });
  const ai = isAiConfigured();
  const missed = r.questions.filter((q) => q.result?.correct === false || (!q.submitted && q.type !== "SCENARIO")).length;

  return (
    <>
      <PageHeader
        title={r.score === null ? "Quiz complete" : `${Math.round(r.score)}%`}
        description={
          r.score === null
            ? "This quiz contained only open-ended questions, which are self-assessed rather than scored."
            : `${r.correctCount} correct out of ${r.questions.filter((q) => q.type !== "SCENARIO").length} scored questions. Missed questions are scheduled to come back soon.`
        }
        actions={<Link href="/quizzes/new" className={buttonClasses("secondary")}>New quiz</Link>}
      />
      <div className="mb-6"><RetryButtons quizId={r.id} hasIncorrect={missed > 0} /></div>

      {r.topicBreakdown.length > 1 ? (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 font-semibold">By topic</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {r.topicBreakdown.map((t) => (
              <li key={t.topicId}>
                <div className="mb-1 flex justify-between text-sm"><span>{t.title}</span><span className="tabular-nums text-muted">{t.correct}/{t.total}</span></div>
                <Meter value={t.correct} max={t.total} label={`${t.title} score`} tone="good" />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ol className="space-y-4">
        {r.questions.map((q, i) => (
          <li key={q.questionId}>
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">{i + 1}.</span>
                <Badge>{q.topic.title}</Badge>
                <DifficultyBadge value={q.difficulty} />
                <Badge>{typeLabel(q.type)}</Badge>
                {!q.submitted ? <Badge tone="bad">Not answered</Badge> : null}
              </div>
              <p className="mt-3 font-medium">{q.prompt}</p>
              {q.codeExample ? <div className="mt-3"><CodeBlock code={q.codeExample} /></div> : null}
              {q.options && q.submitted ? (
                <p className="mt-3 text-sm text-muted">
                  You chose: {q.options.filter((o) => ((q.submitted as { optionIds?: string[] }).optionIds ?? []).includes(o.id)).map((o) => o.text).join("; ")}
                </p>
              ) : null}
              {q.result ? <Feedback result={q.result} type={q.type} /> : null}
              {ai ? <div className="mt-3"><GenerateVariationButton questionId={q.questionId} /></div> : null}
            </Card>
          </li>
        ))}
      </ol>
    </>
  );
}
