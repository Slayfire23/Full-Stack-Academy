"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge, Card, DifficultyBadge, ErrorNote, Input, typeLabel } from "@/components/ui/primitives";
import { CodeBlock } from "@/components/code-block";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/cn";
import type { getLesson } from "@/server/services/learn.service";

type LessonData = Awaited<ReturnType<typeof getLesson>>;
type PracticeQuestion = LessonData["practiceQuestions"][number];
type Progress = LessonData["progress"];

const UNDERSTANDING: { value: number; label: string }[] = [
  { value: 1, label: "Not at all" },
  { value: 2, label: "A little" },
  { value: 3, label: "Somewhat" },
  { value: 4, label: "Well" },
  { value: 5, label: "Very well" },
];

export function LessonView({ initial, returnTo }: { initial: LessonData; returnTo?: string }) {
  const [data, setData] = useState(initial);
  const [understanding, setUnderstanding] = useState<number | null>(initial.progress.understanding);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewedRef = useRef(false);
  const { lesson, progress, practiceQuestions } = data;

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    api<{ progress: Progress }>(`/api/learn/lessons/${lesson.id}/view`, { method: "POST" })
      .then((res) => setData((d) => ({ ...d, progress: res.progress })))
      .catch(() => {});
  }, [lesson.id]);

  async function complete() {
    setCompleting(true);
    setError(null);
    try {
      const res = await api<{ progress: Progress; resolvedMarks: number }>(`/api/learn/lessons/${lesson.id}/complete`, {
        body: { understanding: understanding ?? undefined },
      });
      setData((d) => ({ ...d, progress: res.progress }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not mark this lesson complete.");
    } finally {
      setCompleting(false);
    }
  }

  const backHref = returnTo || `/topics/${lesson.topic.id}`;
  const backLabel = returnTo ? "Back to where you were" : `Back to ${lesson.topic.title}`;

  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <Link href={backHref} className="hover:underline">← {backLabel}</Link>
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge>{lesson.topic.title}</Badge>
        <DifficultyBadge value={lesson.level} />
        <Badge>{lesson.estimatedMinutes} min</Badge>
        {progress.status === "COMPLETED" ? <Badge tone="good">Completed</Badge> : progress.status === "IN_PROGRESS" ? <Badge tone="accent">In progress</Badge> : null}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>
      {lesson.summary ? <p className="mt-2 max-w-prose text-muted">{lesson.summary}</p> : null}

      {lesson.locked ? (
        <Card className="mt-4 border-accent/50 bg-accent-soft p-4 text-sm">
          Recommended to learn {lesson.missingPrerequisites.map((p) => p.title).join(", ")} first — you can still read this now.
        </Card>
      ) : null}

      <div className="mt-6 space-y-8">
        <Section title="Explanation">
          <Markdown source={lesson.explanation || lesson.content} />
        </Section>

        {lesson.realWorldExample ? (
          <Section title="Real-world example">
            <Markdown source={lesson.realWorldExample} />
          </Section>
        ) : null}

        {lesson.codeExample ? (
          <Section title="Code example">
            <CodeBlock code={lesson.codeExample} />
          </Section>
        ) : null}

        {lesson.commonMistakes ? (
          <Section title="Common mistakes">
            <Markdown source={lesson.commonMistakes} />
          </Section>
        ) : null}

        {practiceQuestions.length > 0 ? (
          <Section title="Practice">
            <div className="space-y-4">
              {practiceQuestions.map((q) => (
                <PracticeItem key={q.id} lessonId={lesson.id} question={q} onAnswered={(correct) => setData((d) => ({ ...d, progress: applyPracticeTally(d.progress, correct) }))} />
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Mark as complete">
          {progress.status === "COMPLETED" ? (
            <p className="text-good">
              Completed{progress.understanding ? ` — you rated your understanding "${UNDERSTANDING.find((u) => u.value === progress.understanding)?.label}"` : ""}.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">How well do you understand this concept?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {UNDERSTANDING.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setUnderstanding(u.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm transition-colors",
                      understanding === u.value ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
                    )}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
              <Button className="mt-4" loading={completing} onClick={complete}>Mark as complete</Button>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}

function applyPracticeTally(progress: Progress, correct: boolean | null): Progress {
  if (correct === null) return progress;
  return { ...progress, practiceAttempts: progress.practiceAttempts + 1, practiceCorrect: progress.practiceCorrect + (correct ? 1 : 0) };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

interface PracticeResult {
  correct: boolean | null;
  correctOptionIds?: string[];
  acceptedAnswers?: string[];
  answer: string;
  explanation: string;
  partial?: { hits: number; misses: number; falsePicks: number };
}

function PracticeItem({
  lessonId,
  question,
  onAnswered,
}: {
  lessonId: string;
  question: PracticeQuestion;
  onAnswered: (correct: boolean | null) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const answer = question.options ? { optionIds: selected } : { text };
    if (question.options ? selected.length === 0 : text.trim() === "") {
      setError(question.options ? "Choose an answer first." : "Write an answer first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<PracticeResult>(`/api/learn/lessons/${lessonId}/practice`, {
        body: { questionId: question.id, answer },
      });
      setResult(res);
      onAnswered(res.correct);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Your answer was not saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <DifficultyBadge value={question.difficulty} />
        <Badge>{typeLabel(question.type)}</Badge>
        {question.markedUnfamiliar ? <Badge tone="accent">Marked as not yet learned</Badge> : null}
      </div>
      <p className="mt-3 font-medium leading-snug">{question.prompt}</p>
      {question.scenario ? <p className="mt-2 text-sm text-muted">{question.scenario}</p> : null}
      {question.codeExample ? <div className="mt-3"><CodeBlock code={question.codeExample} /></div> : null}

      <div className="mt-4">
        {question.options ? (
          <fieldset disabled={Boolean(result) || busy}>
            <div className="space-y-2">
              {question.options.map((o) => {
                const chosen = selected.includes(o.id);
                const isCorrect = result?.correctOptionIds?.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                      result && isCorrect ? "border-good bg-good-soft" : result && chosen ? "border-bad bg-bad-soft" : chosen ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
                    )}
                  >
                    <input
                      type={question.multiSelect ? "checkbox" : "radio"}
                      name={`practice-${question.id}`}
                      className="mt-0.5 accent-[var(--accent)]"
                      checked={chosen}
                      onChange={() => setSelected((s) => (question.multiSelect ? (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]) : [o.id]))}
                    />
                    <span className="flex-1">{o.text}</span>
                    {result && isCorrect ? <CheckCircle2 className="size-4 shrink-0 text-good" aria-hidden /> : null}
                    {result && chosen && !isCorrect ? <XCircle className="size-4 shrink-0 text-bad" aria-hidden /> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <Input
            aria-label="Your answer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={Boolean(result) || busy}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Type your answer"
          />
        )}
      </div>

      {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}

      {result ? (
        <div className="mt-4 space-y-2 rounded-lg border border-border bg-bg p-4 text-sm">
          {result.correct === true ? (
            <p className="flex items-center gap-2 font-semibold text-good"><CheckCircle2 className="size-4" aria-hidden /> Correct</p>
          ) : result.correct === false ? (
            <p className="flex items-center gap-2 font-semibold text-bad"><XCircle className="size-4" aria-hidden /> Not quite</p>
          ) : null}
          {result.acceptedAnswers ? <p>Accepted: {result.acceptedAnswers.join(", ")}</p> : !question.options ? <p><span className="font-medium">Answer: </span>{result.answer}</p> : null}
          <p className="leading-relaxed text-muted">{result.explanation}</p>
        </div>
      ) : (
        <Button className="mt-4" size="sm" loading={busy} onClick={submit}>Check answer</Button>
      )}
    </Card>
  );
}

export function LessonLink({ lessonId, children, className }: { lessonId: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={`/learn/${lessonId}`} className={className ?? buttonClasses("secondary", "sm")}>
      {children}
    </Link>
  );
}
