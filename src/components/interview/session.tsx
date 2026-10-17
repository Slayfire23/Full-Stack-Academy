"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge, Card, DifficultyBadge, ErrorNote, Textarea } from "@/components/ui/primitives";
import { CodeBlock } from "@/components/code-block";
import type { getInterview } from "@/server/services/interview.service";
import type { InterviewEvaluation } from "@/lib/ai/evaluation";

type Session = Awaited<ReturnType<typeof getInterview>>;
type Item = Session["questions"][number];

interface RubricResult {
  coverage?: { covered: string[]; missing: string[] };
  selfAssessment?: Record<string, boolean> | null;
}

export function InterviewSession({ initial }: { initial: Session }) {
  const [session, setSession] = useState(initial);
  const [index, setIndex] = useState(() => Math.max(0, initial.questions.findIndex((q) => !q.response)));
  const [completing, setCompleting] = useState(false);
  const item = session.questions[index];
  const allAnswered = session.questions.every((q) => q.response);

  async function complete() {
    setCompleting(true);
    try {
      await api(`/api/interviews/${session.id}/complete`, { method: "POST" });
      setSession({ ...session, completedAt: new Date() });
    } finally {
      setCompleting(false);
    }
  }

  if (!item) return <p className="text-muted">This session has no questions.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <QuestionPanel key={item.id} sessionId={session.id} item={item} aiConfigured={session.aiConfigured} onSaved={setSession} />
      <aside className="space-y-4">
        <Card className="p-4">
          <p className="mb-3 text-sm text-muted">Scenarios</p>
          <ol className="space-y-1">
            {session.questions.map((q, i) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${i === index ? "bg-surface-2 font-medium" : "text-muted hover:bg-surface-2"}`}
                >
                  {i + 1}. {q.response ? "Answered" : "Not answered"}
                </button>
              </li>
            ))}
          </ol>
          {session.completedAt ? (
            <p className="mt-4 text-sm text-good">Session completed.</p>
          ) : allAnswered ? (
            <Button className="mt-4 w-full" size="sm" loading={completing} onClick={complete}>Complete session</Button>
          ) : null}
          <Link href="/interview" className={buttonClasses("ghost", "sm", "mt-2 w-full")}>All sessions</Link>
        </Card>
      </aside>
    </div>
  );
}

function QuestionPanel({
  sessionId,
  item,
  aiConfigured,
  onSaved,
}: {
  sessionId: string;
  item: Item;
  aiConfigured: boolean;
  onSaved: (s: Session) => void;
}) {
  const [text, setText] = useState(item.response?.text ?? "");
  const [editing, setEditing] = useState(!item.response);
  const rubric = (item.response?.rubricResult ?? null) as RubricResult | null;
  const [checks, setChecks] = useState<Record<string, boolean>>(rubric?.selfAssessment ?? {});
  const [busy, setBusy] = useState<"save" | "assess" | "ai" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<InterviewEvaluation | null>((item.response?.aiFeedback as InterviewEvaluation | null) ?? null);

  async function save(selfAssessment?: Record<string, boolean>) {
    setBusy(selfAssessment ? "assess" : "save");
    setError(null);
    try {
      const res = await api<{ session: Session }>(`/api/interviews/${sessionId}/responses`, {
        body: { questionId: item.id, response: text, selfAssessment },
      });
      onSaved(res.session);
      if (!selfAssessment) {
        setEditing(false);
        setAi(null); // feedback described the previous text
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Your answer was not saved.");
    } finally {
      setBusy(null);
    }
  }

  async function askAi() {
    setBusy("ai");
    setError(null);
    try {
      const res = await api<{ aiFeedback: InterviewEvaluation }>(`/api/interviews/${sessionId}/responses/${item.id}/feedback`, { method: "POST" });
      setAi(res.aiFeedback);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "AI feedback failed.");
    } finally {
      setBusy(null);
    }
  }

  const covered = new Set(rubric?.coverage?.covered ?? []);

  return (
    <div className="min-w-0 space-y-4">
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          <Badge>{item.topic.title}</Badge>
          <DifficultyBadge value={item.difficulty} />
        </div>
        <h2 className="mt-4 text-xl leading-snug font-medium">{item.prompt}</h2>
        {item.scenario ? <p className="mt-3 text-muted">{item.scenario}</p> : null}
        {item.codeExample ? <div className="mt-4"><CodeBlock code={item.codeExample} /></div> : null}

        {editing ? (
          <>
            <Textarea
              className="mt-6 min-h-56"
              aria-label="Your answer"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Talk through it as you would to an interviewer: clarify the problem, propose a design, explain trade-offs and failure cases."
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>The model answer is revealed after you save.</span>
              <span>{text.trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => save()} loading={busy === "save"} disabled={!text.trim()}>
                {item.response ? "Save revised answer" : "Save and reveal model answer"}
              </Button>
              {item.response ? <Button variant="ghost" onClick={() => { setText(item.response!.text); setEditing(false); }}>Cancel</Button> : null}
            </div>
          </>
        ) : (
          <div className="mt-6">
            <p className="text-sm font-medium">Your answer</p>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{item.response?.text}</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setEditing(true)}>Revise answer</Button>
          </div>
        )}
        {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
      </Card>

      {item.reveal && !editing ? (
        <>
          <Card className="p-6 sm:p-8">
            <h3 className="font-semibold">Model answer</h3>
            <p className="mt-3 max-w-[72ch] leading-relaxed">{item.reveal.modelAnswer}</p>
            <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-muted">{item.reveal.explanation}</p>
          </Card>

          <Card className="p-6 sm:p-8">
            <h3 className="font-semibold">Did you cover these concepts?</h3>
            <p className="mt-1 text-sm text-muted">Tick what your answer genuinely covered. Highlighted items matched keywords in your answer — a hint, not a verdict.</p>
            <ul className="mt-4 space-y-2">
              {item.reveal.keyConcepts.map((c) => (
                <li key={c.key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-surface-2">
                    <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={Boolean(checks[c.key])} onChange={(e) => setChecks({ ...checks, [c.key]: e.target.checked })} />
                    <span className="flex-1">{c.label}</span>
                    {covered.has(c.key) ? <Badge tone="good">Keyword match</Badge> : null}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="secondary" loading={busy === "assess"} onClick={() => save(checks)}>Save self-assessment</Button>
              {item.response?.score !== null && item.response?.score !== undefined ? (
                <span className="text-sm text-muted">Self-assessed: {item.response.score}% of key concepts</span>
              ) : null}
            </div>
          </Card>

          {aiConfigured ? (
            <Card className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-accent" aria-hidden /> AI feedback</h3>
                {!ai ? <Button variant="secondary" size="sm" loading={busy === "ai"} onClick={askAi}>Get AI feedback</Button> : null}
              </div>
              {ai ? <AiFeedback ai={ai} /> : <p className="mt-2 text-sm text-muted">An AI reviewer scores correctness, completeness, reasoning and clarity, and suggests an improved answer.</p>}
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function AiFeedback({ ai }: { ai: InterviewEvaluation }) {
  const rows: [string, number][] = [
    ["Technical correctness", ai.scores.correctness],
    ["Completeness", ai.scores.completeness],
    ["Reasoning", ai.scores.reasoning],
    ["Clarity", ai.scores.clarity],
  ];
  return (
    <div className="mt-4 space-y-4">
      <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm">{ai.disclaimer}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, v]) => (
          <div key={label} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <dt>{label}</dt>
            <dd className="tabular-nums">{v} / 5</dd>
          </div>
        ))}
      </dl>
      <p className="leading-relaxed">{ai.feedback}</p>
      {ai.missingConcepts.length ? (
        <div>
          <p className="text-sm font-medium">Missing concepts</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted">{ai.missingConcepts.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}
      {ai.improvedAnswer ? (
        <div>
          <p className="text-sm font-medium">Suggested improved answer</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">{ai.improvedAnswer}</p>
        </div>
      ) : null}
    </div>
  );
}
