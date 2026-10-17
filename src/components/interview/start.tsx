"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, ErrorNote, Label, Select } from "@/components/ui/primitives";

export function InterviewStart({ topics, initialTopic, aiConfigured }: { topics: { id: string; title: string }[]; initialTopic?: string; aiConfigured: boolean }) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(initialTopic ?? "");
  const [difficulty, setDifficulty] = useState("INTERMEDIATE");
  const [mode, setMode] = useState("MIXED");
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ sessionId: string }>("/api/interviews", { body: { topicId: topicId || undefined, difficulty, mode, count } });
      router.push(`/interview/${res.sessionId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start a session.");
      setBusy(false);
    }
  }

  async function generate() {
    if (!topicId) {
      setError("Choose a topic to generate a scenario for.");
      return;
    }
    setGenBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ status: string; rejectionReason: string | null }>("/api/generation", { body: { kind: "INTERVIEW_SCENARIO", topicId, difficulty } });
      setNotice(
        res.status === "APPROVED"
          ? "New AI-generated scenario added. Start a session with New questions mode to get it."
          : res.status === "PENDING_REVIEW"
            ? "The AI scenario passed automated checks and is waiting for admin review before it can be used."
            : `The AI draft was rejected by validation: ${res.rejectionReason ?? "unknown reason"}`,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Generation failed.");
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="iv-topic">Topic</Label>
          <Select id="iv-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Any topic</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="iv-diff">Difficulty</Label>
          <Select id="iv-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="iv-mode">Questions</Label>
          <Select id="iv-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="NEW">New to me</option>
            <option value="WEAK">Ones I struggled with</option>
            <option value="MIXED">Mixed</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="iv-count">How many</Label>
          <Select id="iv-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">If a topic has too few scenarios at this difficulty, other difficulties fill the session.</p>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
      {notice ? <p className="mt-4 text-sm text-good" role="status">{notice}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="lg" loading={busy} onClick={start}>Start interview</Button>
        {aiConfigured ? (
          <Button size="lg" variant="ghost" loading={genBusy} onClick={generate}>
            <Sparkles className="size-4" aria-hidden /> Generate a new AI scenario
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function RetryInterviewButton({ questionIds, difficulty }: { questionIds: string[]; difficulty: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await api<{ sessionId: string }>("/api/interviews", { body: { questionIds, difficulty } });
          router.push(`/interview/${res.sessionId}`);
        } catch {
          setBusy(false);
        }
      }}
    >
      Retry these questions
    </Button>
  );
}
