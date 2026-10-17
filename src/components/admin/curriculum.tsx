"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge, Card, ErrorNote, Input, Label, Select, Textarea } from "@/components/ui/primitives";

interface Track { id: string; slug: string; title: string; description: string; published: boolean; order: number }
interface Topic { id: string; trackId: string; slug: string; title: string; description: string; order: number; lessons: { id: string; title: string; content: string }[] }

export function CurriculumManager({ tracks, topics }: { tracks: Track[]; topics: Topic[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newTrack, setNewTrack] = useState({ slug: "", title: "", description: "" });
  const [newTopic, setNewTopic] = useState({ trackId: tracks[0]?.id ?? "", slug: "", title: "", description: "" });
  const [lessonEdit, setLessonEdit] = useState<{ id: string; title: string; content: string } | null>(null);

  async function call(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}${e.details ? ` ${JSON.stringify(e.details)}` : ""}` : "Request failed.");
    }
  }

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
                    <Button size="sm" variant="ghost" onClick={() => setLessonEdit(l)}>Edit lesson</Button>
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

      {lessonEdit ? (
        <Card className="p-6">
          <h2 className="font-semibold">Edit lesson</h2>
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void call(async () => { await api(`/api/admin/lessons/${lessonEdit.id}`, { method: "PATCH", body: { title: lessonEdit.title, content: lessonEdit.content } }); setLessonEdit(null); }); }}>
            <div><Label htmlFor="l-title">Title</Label><Input id="l-title" value={lessonEdit.title} onChange={(e) => setLessonEdit({ ...lessonEdit, title: e.target.value })} /></div>
            <div><Label htmlFor="l-content">Content (Markdown)</Label><Textarea id="l-content" className="min-h-80 font-mono text-xs" value={lessonEdit.content} onChange={(e) => setLessonEdit({ ...lessonEdit, content: e.target.value })} /></div>
            <div className="flex gap-2"><Button type="submit">Save lesson</Button><Button type="button" variant="ghost" onClick={() => setLessonEdit(null)}>Cancel</Button></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
