"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge, Card, DifficultyBadge, ErrorNote, Input, Textarea, typeLabel } from "@/components/ui/primitives";
import { CodeBlock } from "@/components/code-block";
import { cn } from "@/lib/cn";
import type { getQuizView } from "@/server/services/quiz.service";

type Quiz = Awaited<ReturnType<typeof getQuizView>>;
type Q = Quiz["questions"][number];
type Result = NonNullable<Q["result"]>;

const REASON_TEXT: Record<string, string> = {
  new: "new to you",
  due: "due for review",
  incorrect: "missed before",
  "weak-topic": "from a weak topic",
  fresh: "not seen in a while",
  fallback: "seen recently (not enough alternatives)",
  retry: "retry",
};

export function QuizRunner({ initial }: { initial: Quiz }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState(initial);
  const firstOpen = initial.questions.findIndex((q) => !q.submitted);
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(initial.remainingSeconds);
  const shownAt = useRef(Date.now());

  const q = quiz.questions[index]!;
  const answered = quiz.questions.filter((x) => x.submitted).length;
  const reasonSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const x of quiz.questions) counts.set(x.selectionReason, (counts.get(x.selectionReason) ?? 0) + 1);
    return [...counts.entries()].map(([r, n]) => `${n} ${REASON_TEXT[r] ?? r}`).join(", ");
  }, [quiz.questions]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      await api(`/api/quizzes/${quiz.id}/finish`, { method: "POST" });
      router.push(`/quizzes/${quiz.id}/results`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not finish the quiz.");
      setBusy(false);
    }
  }, [quiz.id, router]);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      void finish();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r === null ? r : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [remaining, finish]);

  useEffect(() => {
    setSelected([]);
    setText("");
    setError(null);
    shownAt.current = Date.now();
  }, [index]);

  async function submit() {
    if (q.submitted) return;
    const answer = q.options ? { optionIds: selected } : { text };
    if (q.options ? selected.length === 0 : text.trim() === "") {
      setError(q.options ? "Choose an answer first." : "Write an answer first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ result: Result | null }>(`/api/quizzes/${quiz.id}/answers`, {
        body: { questionId: q.questionId, answer, responseTimeMs: Math.min(Date.now() - shownAt.current, 3_600_000) },
      });
      setQuiz((cur) => ({
        ...cur,
        questions: cur.questions.map((x) => (x.questionId === q.questionId ? { ...x, submitted: answer as Q["submitted"], result: res.result ?? null } : x)),
      }));
      if (quiz.feedbackMode === "END") goNext();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Your answer was not saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    const nextOpen = quiz.questions.findIndex((x, i) => i > index && !x.submitted);
    if (nextOpen !== -1) setIndex(nextOpen);
    else if (index < quiz.questions.length - 1) setIndex(index + 1);
  }

  const result = q.result;
  const submittedIds = (q.submitted as { optionIds?: string[] } | null)?.optionIds ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="min-w-0">
        <p className="mb-3 text-sm text-muted">Picked for you: {reasonSummary}.</p>
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Question {index + 1} of {quiz.questions.length}</span>
            <Badge>{q.topic.title}</Badge>
            <DifficultyBadge value={q.difficulty} />
            <Badge>{typeLabel(q.type)}</Badge>
          </div>
          <h2 className="mt-5 text-xl leading-snug font-medium">{q.prompt}</h2>
          {q.scenario ? <p className="mt-3 text-muted">{q.scenario}</p> : null}
          {q.codeExample ? <div className="mt-4"><CodeBlock code={q.codeExample} /></div> : null}

          <div className="mt-6">
            {q.options ? (
              <fieldset disabled={Boolean(q.submitted) || busy}>
                <legend className="sr-only">{q.multiSelect ? "Select all that apply" : "Choose one answer"}</legend>
                {q.multiSelect ? <p className="mb-2 text-sm text-muted">Select all that apply.</p> : null}
                <div className="space-y-2">
                  {q.options.map((o) => {
                    const chosen = q.submitted ? submittedIds.includes(o.id) : selected.includes(o.id);
                    const isCorrect = result?.correctOptionIds?.includes(o.id);
                    return (
                      <label
                        key={o.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                          result && isCorrect ? "border-good bg-good-soft" : result && chosen ? "border-bad bg-bad-soft" : chosen ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
                          q.submitted && "cursor-default",
                        )}
                      >
                        <input
                          type={q.multiSelect ? "checkbox" : "radio"}
                          name={`q-${q.questionId}`}
                          className="mt-0.5 accent-[var(--accent)]"
                          checked={chosen}
                          onChange={() =>
                            setSelected((s) => (q.multiSelect ? (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]) : [o.id]))
                          }
                        />
                        <span className="flex-1">{o.text}</span>
                        {result && isCorrect ? <CheckCircle2 className="size-4 shrink-0 text-good" aria-label="Correct answer" /> : null}
                        {result && chosen && !isCorrect ? <XCircle className="size-4 shrink-0 text-bad" aria-label="Your incorrect choice" /> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : q.type === "SHORT_ANSWER" ? (
              <Input
                aria-label="Your answer"
                value={q.submitted ? ((q.submitted as { text?: string }).text ?? "") : text}
                onChange={(e) => setText(e.target.value)}
                disabled={Boolean(q.submitted) || busy}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Type a short answer"
              />
            ) : (
              <Textarea
                aria-label="Your answer"
                value={q.submitted ? ((q.submitted as { text?: string }).text ?? "") : text}
                onChange={(e) => setText(e.target.value)}
                disabled={Boolean(q.submitted) || busy}
                placeholder="Explain your approach as you would in an interview."
                className="min-h-40"
              />
            )}
          </div>

          {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}

          {result ? <Feedback result={result} type={q.type} /> : q.submitted && quiz.feedbackMode === "END" ? (
            <p className="mt-4 text-sm text-muted" role="status">Answer saved. Results appear when you finish.</p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {!q.submitted ? (
              <Button onClick={submit} loading={busy}>Submit answer</Button>
            ) : index < quiz.questions.length - 1 ? (
              <Button onClick={goNext}>Next question</Button>
            ) : null}
            {answered === quiz.questions.length ? (
              <Button variant={q.submitted ? "primary" : "secondary"} onClick={finish} loading={busy}>See results</Button>
            ) : null}
          </div>
        </Card>
      </div>

      <aside className="space-y-4">
        {remaining !== null ? (
          <Card className="p-4" aria-live="off">
            <p className="text-sm text-muted">Time left</p>
            <p className={cn("text-2xl font-semibold tabular-nums", remaining < 60 && "text-bad")}>
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
            </p>
          </Card>
        ) : null}
        <Card className="p-4">
          <p className="mb-3 text-sm text-muted">{answered} of {quiz.questions.length} answered</p>
          <ol className="grid grid-cols-5 gap-1.5">
            {quiz.questions.map((x, i) => (
              <li key={x.questionId}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Question ${i + 1}${x.submitted ? ", answered" : ""}`}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "size-8 rounded-md text-xs tabular-nums",
                    i === index ? "ring-2 ring-accent" : "",
                    x.result?.correct === true ? "bg-good-soft text-good" : x.result?.correct === false ? "bg-bad-soft text-bad" : x.submitted ? "bg-surface-2" : "border border-border",
                  )}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
          <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={() => window.confirm("Finish now? Unanswered questions count as incorrect.") && finish()}>
            Finish early
          </Button>
        </Card>
      </aside>
    </div>
  );
}

export function Feedback({ result, type }: { result: Result; type: string }) {
  return (
    <div className="mt-5 space-y-3 rounded-lg border border-border bg-bg p-4" role="status">
      {result.correct === true ? (
        <p className="flex items-center gap-2 font-semibold text-good"><CheckCircle2 className="size-5" aria-hidden /> Correct</p>
      ) : result.correct === false ? (
        <p className="flex items-center gap-2 font-semibold text-bad"><XCircle className="size-5" aria-hidden /> Not quite</p>
      ) : (
        <p className="font-semibold">Compare your answer with the model answer</p>
      )}
      {result.partial && result.correct === false ? (
        <p className="text-sm text-muted">You picked {result.partial.hits} of the right options{result.partial.falsePicks ? ` and ${result.partial.falsePicks} wrong one${result.partial.falsePicks === 1 ? "" : "s"}` : ""}. Multiple-select is all or nothing.</p>
      ) : null}
      {type === "SHORT_ANSWER" && result.correct === false ? <p className="text-sm">Accepted: {result.acceptedAnswers?.join(", ")}</p> : null}
      {result.modelAnswer ? (
        <div>
          <p className="text-sm font-medium">Model answer</p>
          <p className="mt-1 text-sm leading-relaxed">{result.modelAnswer}</p>
        </div>
      ) : (
        <p className="text-sm"><span className="font-medium">Answer: </span>{result.answer}</p>
      )}
      <p className="text-sm leading-relaxed text-muted">{result.explanation}</p>
      {result.rubric ? (
        <div className="text-sm">
          <p className="font-medium">Key concepts</p>
          <ul className="mt-1 space-y-1">
            {result.keyConcepts?.map((c) => (
              <li key={c.key} className={result.rubric!.covered.includes(c.key) ? "text-good" : "text-muted"}>
                {result.rubric!.covered.includes(c.key) ? "Mentioned: " : "Not mentioned: "}{c.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Keyword matching only — a hint, not a grade. Scenario answers do not affect your quiz score.</p>
        </div>
      ) : null}
    </div>
  );
}
