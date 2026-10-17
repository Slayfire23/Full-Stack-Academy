"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge, Card, ErrorNote, Input, Label, Select, Textarea, typeLabel } from "@/components/ui/primitives";

interface Track { id: string; slug: string; title: string; description: string; published: boolean; order: number }
interface LessonQuestion { id: string; prompt: string; type: string }
interface Lesson {
  id: string;
  topicId: string;
  title: string;
  content: string;
  summary: string | null;
  explanation: string | null;
  realWorldExample: string | null;
  codeExample: string | null;
  codeLanguage: string | null;
  commonMistakes: string | null;
  level: string;
  estimatedMinutes: number;
  published: boolean;
  order: number;
  prerequisites: { prerequisiteId: string; prerequisite: { title: string } }[];
  questions: LessonQuestion[];
}
interface Topic {
  id: string;
  trackId: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
  questions: LessonQuestion[]; // this topic's questions not yet linked to any lesson
}
interface LessonRef { id: string; title: string; topicId: string }

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const CODE_LANGUAGES = ["TYPESCRIPT", "SQL", "HTTP", "BASH"];

export function CurriculumManager({ tracks, topics, allLessons }: { tracks: Track[]; topics: Topic[]; allLessons: LessonRef[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newTrack, setNewTrack] = useState({ slug: "", title: "", description: "" });
  const [newTopic, setNewTopic] = useState({ trackId: tracks[0]?.id ?? "", slug: "", title: "", description: "" });
  const [lessonEditId, setLessonEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [addPrereq, setAddPrereq] = useState("");
  const [addQuestion, setAddQuestion] = useState("");

  async function call(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}${e.details ? ` ${JSON.stringify(e.details)}` : ""}` : "Request failed.");
    }
  }

  function openLesson(l: Lesson) {
    setLessonEditId(l.id);
    setDraft(l);
    setAddPrereq("");
    setAddQuestion("");
  }

  const editingTopic = draft ? topics.find((t) => t.id === draft.topicId) : undefined;
  const prereqOptions = draft ? allLessons.filter((l) => l.id !== draft.id && !draft.prerequisites.some((p) => p.prerequisiteId === l.id)) : [];

  return (
    <div className="space-y-6">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card className="p-6">
        <h2 className="font-semibold">Tracks</h2>
        <ul className="mt-3 divide-y divide-border">
          {tracks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="flex-1">{t.title} <span className="text-sm text-muted">/{t.slug}</span></span>
              <Badge tone={t.published ? "good" : "neutral"}>{t.published ? "Published" : "Coming soon"}</Badge>
              <Button size="sm" variant="ghost" onClick={() => call(() => api(`/api/admin/tracks/${t.id}`, { method: "PATCH", body: { published: !t.published } }))}>
                {t.published ? "Unpublish" : "Publish"}
              </Button>
            </li>
          ))}
        </ul>
        <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); void call(() => api("/api/admin/tracks", { body: newTrack })); }}>
          <Input placeholder="slug" aria-label="Track slug" value={newTrack.slug} onChange={(e) => setNewTrack({ ...newTrack, slug: e.target.value })} />
          <Input placeholder="Title" aria-label="Track title" value={newTrack.title} onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })} />
          <Input placeholder="Description" aria-label="Track description" value={newTrack.description} onChange={(e) => setNewTrack({ ...newTrack, description: e.target.value })} />
          <Button type="submit" variant="secondary">Add track</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Topics and lessons</h2>
        <ul className="mt-3 divide-y divide-border">
          {topics.map((t) => (
            <li key={t.id} className="py-3">
              <p className="font-medium">{t.title} <span className="text-sm font-normal text-muted">/{t.slug}</span></p>
              <ul className="mt-1 space-y-1">
                {t.lessons.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm text-muted">
                    <span className="flex-1">{l.title}</span>
                    <Badge>{l.level}</Badge>
                    <Badge tone={l.published ? "good" : "neutral"}>{l.published ? "Published" : "Draft"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => openLesson(l)}>Edit lesson</Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); void call(() => api("/api/admin/topics", { body: newTopic })); }}>
          <Select aria-label="Track" value={newTopic.trackId} onChange={(e) => setNewTopic({ ...newTopic, trackId: e.target.value })}>
            {tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
          <Input placeholder="slug" aria-label="Topic slug" value={newTopic.slug} onChange={(e) => setNewTopic({ ...newTopic, slug: e.target.value })} />
          <Input placeholder="Title" aria-label="Topic title" value={newTopic.title} onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} />
          <Button type="submit" variant="secondary">Add topic</Button>
        </form>
      </Card>

      {draft && lessonEditId ? (
        <Card className="p-6">
          <h2 className="font-semibold">Edit lesson</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void call(async () => {
                await api(`/api/admin/lessons/${draft.id}`, {
                  method: "PATCH",
                  body: {
                    title: draft.title,
                    content: draft.content,
                    summary: draft.summary || null,
                    explanation: draft.explanation || null,
                    realWorldExample: draft.realWorldExample || null,
                    codeExample: draft.codeExample || null,
                    codeLanguage: draft.codeExample ? draft.codeLanguage : null,
                    commonMistakes: draft.commonMistakes || null,
                    level: draft.level,
                    estimatedMinutes: draft.estimatedMinutes,
                    published: draft.published,
                  },
                });
                setLessonEditId(null);
                setDraft(null);
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="l-title">Title</Label><Input id="l-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div>
                <Label htmlFor="l-level">Level</Label>
                <Select id="l-level" value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })}>
                  {LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="l-minutes">Estimated minutes</Label><Input id="l-minutes" type="number" min={1} max={180} value={draft.estimatedMinutes} onChange={(e) => setDraft({ ...draft, estimatedMinutes: Number(e.target.value) })} /></div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-[var(--accent)]" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />
                  Published
                </label>
              </div>
            </div>
            <div><Label htmlFor="l-summary">Summary (one line)</Label><Input id="l-summary" value={draft.summary ?? ""} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></div>
            <div><Label htmlFor="l-explanation">Explanation (Markdown)</Label><Textarea id="l-explanation" className="min-h-40 font-mono text-xs" value={draft.explanation ?? ""} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} /></div>
            <div><Label htmlFor="l-example">Real-world example (Markdown)</Label><Textarea id="l-example" className="min-h-28 font-mono text-xs" value={draft.realWorldExample ?? ""} onChange={(e) => setDraft({ ...draft, realWorldExample: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
              <div><Label htmlFor="l-code">Code example</Label><Textarea id="l-code" className="min-h-28 font-mono text-xs" value={draft.codeExample ?? ""} onChange={(e) => setDraft({ ...draft, codeExample: e.target.value })} /></div>
              <div>
                <Label htmlFor="l-code-lang">Language</Label>
                <Select id="l-code-lang" value={draft.codeLanguage ?? ""} onChange={(e) => setDraft({ ...draft, codeLanguage: e.target.value || null })}>
                  <option value="">—</option>
                  {CODE_LANGUAGES.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
                </Select>
              </div>
            </div>
            <div><Label htmlFor="l-mistakes">Common mistakes (Markdown)</Label><Textarea id="l-mistakes" className="min-h-28 font-mono text-xs" value={draft.commonMistakes ?? ""} onChange={(e) => setDraft({ ...draft, commonMistakes: e.target.value })} /></div>
            <div><Label htmlFor="l-content">Legacy content (Markdown fallback)</Label><Textarea id="l-content" className="min-h-40 font-mono text-xs" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></div>
            <div className="flex gap-2"><Button type="submit">Save lesson</Button><Button type="button" variant="ghost" onClick={() => { setLessonEditId(null); setDraft(null); }}>Cancel</Button></div>
          </form>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="font-medium">Prerequisites</h3>
            <ul className="mt-2 space-y-1">
              {draft.prerequisites.length === 0 ? <li className="text-sm text-muted">None.</li> : null}
              {draft.prerequisites.map((p) => (
                <li key={p.prerequisiteId} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{p.prerequisite.title}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => call(async () => {
                      await api(`/api/admin/lessons/${draft.id}/prerequisites/${p.prerequisiteId}`, { method: "DELETE" });
                      setDraft({ ...draft, prerequisites: draft.prerequisites.filter((x) => x.prerequisiteId !== p.prerequisiteId) });
                    })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Select aria-label="Add prerequisite" value={addPrereq} onChange={(e) => setAddPrereq(e.target.value)}>
                <option value="">Choose a lesson…</option>
                {prereqOptions.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </Select>
              <Button
                variant="secondary"
                disabled={!addPrereq}
                onClick={() => call(async () => {
                  await api(`/api/admin/lessons/${draft.id}/prerequisites`, { body: { prerequisiteId: addPrereq } });
                  const added = allLessons.find((l) => l.id === addPrereq);
                  if (added) setDraft({ ...draft, prerequisites: [...draft.prerequisites, { prerequisiteId: added.id, prerequisite: { title: added.title } }] });
                  setAddPrereq("");
                })}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="font-medium">Practice questions</h3>
            <ul className="mt-2 space-y-1">
              {draft.questions.length === 0 ? <li className="text-sm text-muted">None linked yet.</li> : null}
              {draft.questions.map((q) => (
                <li key={q.id} className="flex items-center gap-2 text-sm">
                  <Badge>{typeLabel(q.type)}</Badge>
                  <span className="flex-1 truncate">{q.prompt}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => call(async () => {
                      await api(`/api/admin/lessons/${draft.id}/questions/${q.id}`, { method: "DELETE" });
                      setDraft({ ...draft, questions: draft.questions.filter((x) => x.id !== q.id) });
                    })}
                  >
                    Unlink
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Select aria-label="Link a question" value={addQuestion} onChange={(e) => setAddQuestion(e.target.value)}>
                <option value="">Choose a question in this topic…</option>
                {(editingTopic?.questions ?? []).map((q) => <option key={q.id} value={q.id}>{q.prompt.slice(0, 80)}</option>)}
              </Select>
              <Button
                variant="secondary"
                disabled={!addQuestion}
                onClick={() => call(async () => {
                  await api(`/api/admin/lessons/${draft.id}/questions`, { body: { questionId: addQuestion } });
                  const linked = editingTopic?.questions.find((q) => q.id === addQuestion);
                  if (linked) setDraft({ ...draft, questions: [...draft.questions, linked] });
                  setAddQuestion("");
                })}
              >
                Link
              </Button>
            </div>
            {!editingTopic || editingTopic.questions.length === 0 ? <p className="mt-2 text-xs text-muted">No unlinked questions left in this topic.</p> : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
