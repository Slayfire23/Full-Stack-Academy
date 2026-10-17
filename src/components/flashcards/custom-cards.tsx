"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge, Card, DifficultyBadge, EmptyState, ErrorNote, Input, Label, Select, Textarea } from "@/components/ui/primitives";

interface CustomCard {
  id: string;
  prompt: string;
  answer: string;
  explanation: string;
  difficulty: string;
  tags: string[];
  topic: { id: string; title: string };
}

const blank = { id: "", topicId: "", difficulty: "BEGINNER", prompt: "", answer: "", explanation: "", tags: "" };

export function CustomCards({ cards, topics }: { cards: CustomCard[]; topics: { id: string; title: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...blank, topicId: topics[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editing = Boolean(form.id);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const body = {
      topicId: form.topicId,
      difficulty: form.difficulty,
      prompt: form.prompt,
      answer: form.answer,
      explanation: form.explanation || undefined,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        await api(`/api/flashcards/custom/${form.id}`, { method: "PATCH", body });
        setNotice("Card updated.");
      } else {
        const res = await api<{ similarTo: { questionId: string; score: number } | null }>("/api/flashcards/custom", { body });
        setNotice(res.similarTo ? "Card added. It is similar to a question already in the bank — that's fine, it stays private to you." : "Card added. It will appear in your flashcard sessions.");
      }
      setForm({ ...blank, topicId: form.topicId });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? describe(err) : "Could not save the card.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this card and its review history?")) return;
    try {
      await api(`/api/flashcards/custom/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the card.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="h-fit p-6">
        <h2 className="font-semibold">{editing ? "Edit card" : "New card"}</h2>
        <form onSubmit={save} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cc-topic">Topic</Label>
              <Select id="cc-topic" value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })} required>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="cc-diff">Difficulty</Label>
              <Select id="cc-diff" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="cc-prompt">Question</Label>
            <Textarea id="cc-prompt" className="min-h-20" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} required minLength={10} />
          </div>
          <div>
            <Label htmlFor="cc-answer">Answer</Label>
            <Textarea id="cc-answer" className="min-h-20" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="cc-expl">Why it&apos;s right (optional)</Label>
            <Textarea id="cc-expl" className="min-h-20" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cc-tags">Tags (comma separated, optional)</Label>
            <Input id="cc-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="postgres, locking" />
          </div>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          {notice ? <p className="text-sm text-good" role="status">{notice}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>{editing ? "Save changes" : "Add card"}</Button>
            {editing ? <Button type="button" variant="ghost" onClick={() => setForm({ ...blank, topicId: form.topicId })}>Cancel</Button> : null}
          </div>
        </form>
      </Card>

      <div>
        {cards.length === 0 ? (
          <EmptyState title="No custom cards yet">Write cards for things you keep forgetting. They are private to you and scheduled like every other card.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {cards.map((c) => (
              <li key={c.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap gap-2"><Badge>{c.topic.title}</Badge><DifficultyBadge value={c.difficulty} /></div>
                  <p className="mt-3 font-medium">{c.prompt}</p>
                  <p className="mt-1 text-sm text-muted">{c.answer}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setForm({ id: c.id, topicId: c.topic.id, difficulty: c.difficulty, prompt: c.prompt, answer: c.answer, explanation: c.explanation, tags: c.tags.filter((t) => t !== "custom").join(", ") })}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>Delete</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function describe(err: ApiError) {
  const d = err.details as Record<string, unknown> | undefined;
  if (d && Array.isArray(d.errors)) return `${err.message}: ${(d.errors as string[]).join(" ")}`;
  if (d && typeof d === "object") {
    const msgs = Object.entries(d).map(([k, v]) => `${k}: ${String(v)}`);
    if (msgs.length) return `${err.message} (${msgs.join("; ")})`;
  }
  return err.message;
}
