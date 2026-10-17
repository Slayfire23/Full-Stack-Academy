"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, ErrorNote, Label, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

type Mode = "NEW" | "WEAK" | "MIXED";

const MODES: { value: Mode; title: string; body: string }[] = [
  { value: "NEW", title: "New questions", body: "Questions you have never answered first, then the ones you saw longest ago." },
  { value: "WEAK", title: "Review weak topics", body: "Questions you missed, reviews that are due, and your lowest-accuracy topics." },
  { value: "MIXED", title: "Mixed practice", body: "A blend: about 40% due or missed, 20% weak topics, 40% new." },
];

const TYPES = [
  { value: "MULTIPLE_CHOICE", label: "Multiple choice" },
  { value: "MULTIPLE_SELECT", label: "Select all that apply" },
  { value: "CODE_READING", label: "Code reading" },
  { value: "SHORT_ANSWER", label: "Short answer" },
  { value: "SCENARIO", label: "Scenarios (self-assessed)" },
];

export function QuizSetup({
  topics,
  initialMode,
  initialTopic,
  defaultMode,
}: {
  topics: { id: string; title: string }[];
  initialMode?: Mode;
  initialTopic?: string;
  defaultMode: Mode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode ?? defaultMode);
  const [topicIds, setTopicIds] = useState<string[]>(initialTopic ? [initialTopic] : []);
  const [difficulty, setDifficulty] = useState("");
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<string[]>(["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "CODE_READING", "SHORT_ANSWER"]);
  const [feedbackMode, setFeedbackMode] = useState<"IMMEDIATE" | "END">("IMMEDIATE");
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ quizId: string }>("/api/quizzes", {
        body: {
          mode,
          topicIds,
          difficulty: difficulty || undefined,
          count,
          types,
          feedbackMode,
          timeLimitSeconds: timed ? minutes * 60 : null,
        },
      });
      router.push(`/quizzes/${res.quizId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the quiz.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 font-semibold">What do you want to practise?</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={cn(
                "cursor-pointer rounded-xl border bg-surface p-5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]",
                mode === m.value ? "border-accent ring-1 ring-accent" : "border-border hover:border-muted",
              )}
            >
              <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="sr-only" />
              <span className="block font-semibold">{m.title}</span>
              <span className="mt-1.5 block text-sm text-muted">{m.body}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Every quiz is drawn fresh: questions and answer order are shuffled, and anything you answered in the last day is held back while there are alternatives.
        </p>
      </fieldset>

      <Card className="grid gap-6 p-6 lg:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Topics <span className="font-normal text-muted">({topicIds.length === 0 ? "all" : topicIds.length} selected)</span></legend>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {topics.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-2">
                <input type="checkbox" checked={topicIds.includes(t.id)} onChange={() => setTopicIds(toggle(topicIds, t.id))} className="accent-[var(--accent)]" />
                {t.title}
              </label>
            ))}
          </div>
          {topicIds.length > 0 ? (
            <button type="button" className="mt-2 text-sm text-muted underline underline-offset-4" onClick={() => setTopicIds([])}>Clear — use all topics</button>
          ) : null}
          {topicIds.length === 1 ? (
            <Link href={`/topics/${topicIds[0]}`} className="mt-2 block text-sm text-accent hover:underline">
              Study the lesson first
            </Link>
          ) : null}
        </fieldset>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="q-diff">Difficulty</Label>
              <Select id="q-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">Any</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="q-count">Questions</Label>
              <Select id="q-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Question types</legend>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <label key={t.value} className={cn("cursor-pointer rounded-lg border px-3 py-1.5 text-sm", types.includes(t.value) ? "border-accent bg-accent-soft" : "border-border")}>
                  <input type="checkbox" className="sr-only" checked={types.includes(t.value)} onChange={() => setTypes(toggle(types, t.value).length ? toggle(types, t.value) : types)} />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="q-fb">Feedback</Label>
              <Select id="q-fb" value={feedbackMode} onChange={(e) => setFeedbackMode(e.target.value as "IMMEDIATE" | "END")}>
                <option value="IMMEDIATE">After each question (practice)</option>
                <option value="END">At the end (test)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="q-time">Time limit</Label>
              <div className="flex gap-2">
                <Select id="q-time" value={timed ? String(minutes) : "off"} onChange={(e) => { const v = e.target.value; setTimed(v !== "off"); if (v !== "off") setMinutes(Number(v)); }}>
                  <option value="off">None</option>
                  {[5, 10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </Select>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button size="lg" loading={busy} onClick={create}>Start quiz</Button>
    </div>
  );
}
