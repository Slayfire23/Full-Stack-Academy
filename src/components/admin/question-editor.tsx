"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, ErrorNote, Input, Label, Select, Textarea } from "@/components/ui/primitives";

const TEMPLATES: Record<string, unknown> = {
  FLASHCARD: { kind: "FLASHCARD" },
  MULTIPLE_CHOICE: { kind: "MULTIPLE_CHOICE", options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }], correctOptionIds: ["a"] },
  MULTIPLE_SELECT: { kind: "MULTIPLE_SELECT", options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }, { id: "d", text: "" }], correctOptionIds: ["a", "b"] },
  CODE_READING: { kind: "CODE_READING", options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }], correctOptionIds: ["a"] },
  SHORT_ANSWER: { kind: "SHORT_ANSWER", acceptedAnswers: [""] },
  SCENARIO: { kind: "SCENARIO", modelAnswer: "", keyConcepts: [{ key: "concept-one", label: "", keywords: [""] }] },
};

interface Form {
  id?: string;
  topicId: string;
  type: string;
  difficulty: string;
  prompt: string;
  answer: string;
  explanation: string;
  answerData: unknown;
  codeExample: string;
  scenario: string;
  tags: string;
  published: boolean;
}

export function QuestionEditor({ topics, initial }: { topics: { id: string; title: string }[]; initial?: Form }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(
    initial ?? { topicId: topics[0]?.id ?? "", type: "MULTIPLE_CHOICE", difficulty: "BEGINNER", prompt: "", answer: "", explanation: "", answerData: TEMPLATES.MULTIPLE_CHOICE, codeExample: "", scenario: "", tags: "", published: true },
  );
  const [json, setJson] = useState(JSON.stringify(f.answerData, null, 2));
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setWarnings([]);
    let answerData: unknown;
    try {
      answerData = JSON.parse(json);
    } catch {
      setErrors(["Answer data is not valid JSON."]);
      return;
    }
    setBusy(true);
    const body = {
      topicId: f.topicId,
      type: f.type,
      difficulty: f.difficulty,
      prompt: f.prompt,
      answer: f.answer,
      explanation: f.explanation,
      answerData,
      codeExample: f.codeExample || null,
      scenario: f.scenario || null,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      published: f.published,
    };
    try {
      const res = await api<{ id: string; warnings?: string[] }>(f.id ? `/api/admin/questions/${f.id}` : "/api/admin/questions", { method: f.id ? "PATCH" : "POST", body });
      setWarnings(res.warnings ?? []);
      if (!f.id) router.push(`/admin/questions/${res.id}`);
      else router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const d = err.details as { errors?: string[] } | Record<string, string> | undefined;
        setErrors([err.message, ...(d && "errors" in d && Array.isArray(d.errors) ? d.errors : d ? Object.entries(d).map(([k, v]) => `${k}: ${String(v)}`) : [])]);
      } else setErrors(["Save failed."]);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!f.id || !window.confirm("Delete this question? If learners have answered it, it will be unpublished instead.")) return;
    const res = await api<{ deleted: boolean }>(`/api/admin/questions/${f.id}`, { method: "DELETE" });
    if (res.deleted) router.push("/admin/questions");
    else {
      setF({ ...f, published: false });
      setWarnings(["Learners have history on this question, so it was unpublished instead of deleted."]);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="e-topic">Topic</Label>
            <Select id="e-topic" value={f.topicId} onChange={(e) => setF({ ...f, topicId: e.target.value })}>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="e-type">Type</Label>
            <Select id="e-type" value={f.type} onChange={(e) => { setF({ ...f, type: e.target.value }); if (!f.id) setJson(JSON.stringify(TEMPLATES[e.target.value], null, 2)); }}>
              {Object.keys(TEMPLATES).map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="e-diff">Difficulty</Label>
            <Select id="e-diff" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </Select>
          </div>
        </div>
        <div><Label htmlFor="e-prompt">Prompt</Label><Textarea id="e-prompt" className="min-h-24" value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} /></div>
        <div><Label htmlFor="e-answer">Canonical answer (shown on flashcards and after grading)</Label><Textarea id="e-answer" className="min-h-20" value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} /></div>
        <div><Label htmlFor="e-expl">Explanation</Label><Textarea id="e-expl" className="min-h-28" value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} /></div>
        <div><Label htmlFor="e-tags">Tags (comma separated)</Label><Input id="e-tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Published</label>
      </Card>
      <Card className="space-y-4 p-6">
        <div>
          <Label htmlFor="e-json">Answer data (JSON)</Label>
          <Textarea id="e-json" className="min-h-64 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
          <p className="mt-1 text-xs text-muted">Option text must not refer to other options by position — answer order is shuffled in every quiz.</p>
        </div>
        <div><Label htmlFor="e-code">Code example (optional)</Label><Textarea id="e-code" className="min-h-24 font-mono text-xs" value={f.codeExample} onChange={(e) => setF({ ...f, codeExample: e.target.value })} spellCheck={false} /></div>
        <div><Label htmlFor="e-scn">Scenario context (optional)</Label><Textarea id="e-scn" className="min-h-20" value={f.scenario} onChange={(e) => setF({ ...f, scenario: e.target.value })} /></div>
        {errors.length ? <ErrorNote><ul className="list-disc pl-4">{errors.map((x) => <li key={x}>{x}</li>)}</ul></ErrorNote> : null}
        {warnings.length ? <ul className="list-disc pl-4 text-sm text-accent">{warnings.map((x) => <li key={x}>{x}</li>)}</ul> : null}
        <div className="flex gap-2">
          <Button type="submit" loading={busy}>{f.id ? "Save changes" : "Create question"}</Button>
          {f.id ? <Button type="button" variant="ghost" onClick={remove}>Delete</Button> : null}
        </div>
      </Card>
    </form>
  );
}
