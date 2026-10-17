"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError, newIdempotencyKey } from "@/lib/api-client";
import { scheduleReview, type Rating } from "@/lib/adaptive/srs";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge, Card, DifficultyBadge, EmptyState, ErrorNote, Label, Select, typeLabel } from "@/components/ui/primitives";
import { CodeBlock } from "@/components/code-block";
import { TeachMeLink, UnfamiliarButton } from "@/components/learn/actions";
import { cn } from "@/lib/cn";
import type { buildQueue } from "@/server/services/flashcard.service";

type CardData = Awaited<ReturnType<typeof buildQueue>>[number];
interface SessionResp {
  session: { id: string | null; cards: CardData[]; resumed: boolean; state: { index: number; reviewed: string[] } | null } | null;
}

const RATINGS: { rating: Rating; label: string; key: string; tone: string }[] = [
  { rating: "AGAIN", label: "Again", key: "1", tone: "border-bad/50 hover:bg-bad-soft" },
  { rating: "HARD", label: "Hard", key: "2", tone: "border-border hover:bg-surface-2" },
  { rating: "GOOD", label: "Good", key: "3", tone: "border-good/50 hover:bg-good-soft" },
  { rating: "EASY", label: "Easy", key: "4", tone: "border-border hover:bg-surface-2" },
];

function intervalLabel(card: CardData, rating: Rating) {
  const p = card.progress;
  const next = scheduleReview(
    { repetitions: p?.repetitions ?? 0, intervalDays: p?.intervalDays ?? 0, easeFactor: p?.easeFactor ?? 2.5, lapses: p?.lapses ?? 0 },
    rating,
    new Date(),
  );
  if (rating === "AGAIN") return "in 10 min";
  return next.intervalDays === 1 ? "tomorrow" : `in ${next.intervalDays} days`;
}

export function FlashcardStudy({
  topics,
  initialTopic,
  autoStart,
}: {
  topics: { id: string; title: string }[];
  initialTopic?: string;
  autoStart: boolean;
}) {
  const [phase, setPhase] = useState<"loading" | "setup" | "study" | "done">("loading");
  const [resumable, setResumable] = useState<SessionResp["session"]>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState<Record<string, Rating>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ topicId: initialTopic ?? "", difficulty: "", mode: "due" as "due" | "incorrect" | "bookmarked" });
  const keyRef = useRef<Record<string, string>>({});
  const shownAt = useRef(Date.now());

  const start = useCallback(
    async (f = filters) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api<SessionResp>("/api/flashcards/session", {
          body: {
            topicIds: f.topicId ? [f.topicId] : [],
            difficulty: f.difficulty || undefined,
            incorrectOnly: f.mode === "incorrect",
            bookmarkedOnly: f.mode === "bookmarked",
            includeNew: f.mode === "due",
          },
        });
        const s = res.session;
        if (!s || s.cards.length === 0) {
          setPhase("setup");
          setError(f.mode === "incorrect" ? "No missed questions to review — nice." : f.mode === "bookmarked" ? "You have no bookmarked questions with these filters." : "No cards match these filters.");
          return;
        }
        open(s);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not start a session.");
        setPhase("setup");
      } finally {
        setBusy(false);
      }
    },
    [filters],
  );

  function open(s: NonNullable<SessionResp["session"]>) {
    setSessionId(s.id);
    setCards(s.cards);
    const reviewed = new Set(s.state?.reviewed ?? []);
    const firstOpen = s.cards.findIndex((c) => !reviewed.has(c.id));
    setIndex(Math.max(0, firstOpen === -1 ? s.cards.length - 1 : firstOpen));
    setRated({}); // the tally counts ratings made in this visit; earlier ones are already saved
    setFlipped(false);
    setPhase("study");
    shownAt.current = Date.now();
  }

  useEffect(() => {
    let cancelled = false;
    api<SessionResp>("/api/flashcards/session")
      .then((res) => {
        if (cancelled) return;
        if (res.session && res.session.cards.length > 0) {
          setResumable(res.session);
          setPhase("setup");
        } else if (autoStart) {
          void start();
        } else setPhase("setup");
      })
      .catch(() => !cancelled && setPhase("setup"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = cards[index];

  const rate = useCallback(
    async (rating: Rating) => {
      if (!card || busy) return;
      setBusy(true);
      setError(null);
      // One key per card view: a double click or a network retry is recorded once.
      keyRef.current[card.id] ??= newIdempotencyKey();
      try {
        await api("/api/flashcards/reviews", {
          body: {
            questionId: card.id,
            rating,
            sessionId: sessionId ?? undefined,
            idempotencyKey: keyRef.current[card.id],
            responseTimeMs: Math.min(Date.now() - shownAt.current, 3_600_000),
          },
        });
        setRated((r) => ({ ...r, [card.id]: rating }));
        if (index + 1 >= cards.length) setPhase("done");
        else {
          setIndex(index + 1);
          setFlipped(false);
          shownAt.current = Date.now();
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Your rating was not saved. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, card, cards.length, index, sessionId],
  );

  const move = useCallback(
    (delta: number) => {
      const next = Math.min(cards.length - 1, Math.max(0, index + delta));
      setIndex(next);
      setFlipped(false);
      shownAt.current = Date.now();
      if (sessionId) void api(`/api/flashcards/session/${sessionId}`, { method: "PATCH", body: { index: next } }).catch(() => {});
    },
    [cards.length, index, sessionId],
  );

  const toggleBookmark = async () => {
    if (!card) return;
    const was = card.bookmarked;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, bookmarked: !was } : c)));
    try {
      if (was) await api(`/api/bookmarks/${card.id}`, { method: "DELETE" });
      else await api("/api/bookmarks", { body: { questionId: card.id } });
    } catch {
      setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, bookmarked: was } : c)));
    }
  };

  useEffect(() => {
    if (phase !== "study") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || e.metaKey || e.ctrlKey) return;
      if (e.key === " " || e.key === "Enter") {
        if (t.tagName === "BUTTON" && e.key === "Enter") return;
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        void rate(RATINGS[Number(e.key) - 1]!.rating);
      } else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, flipped, rate, move]);

  const tally = useMemo(() => {
    const t: Record<Rating, number> = { AGAIN: 0, HARD: 0, GOOD: 0, EASY: 0 };
    for (const r of Object.values(rated)) t[r]++;
    return t;
  }, [rated]);

  if (phase === "loading") return <p className="text-muted" aria-busy>Loading your review queue…</p>;

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        {resumable ? (
          <Card className="flex flex-wrap items-center justify-between gap-4 border-accent/60 p-5">
            <div>
              <p className="font-semibold">You have an unfinished session</p>
              <p className="text-sm text-muted">
                {resumable.cards.length - (resumable.state?.reviewed.length ?? 0)} of {resumable.cards.length} cards left.
              </p>
            </div>
            <Button onClick={() => open(resumable)}>Resume session</Button>
          </Card>
        ) : null}
        <Card className="p-6">
          <h2 className="font-semibold">{resumable ? "Or start a new session" : "Start a session"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="fc-mode">Cards</Label>
              <Select id="fc-mode" value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value as typeof filters.mode })}>
                <option value="due">Due reviews + new cards</option>
                <option value="incorrect">Questions I got wrong</option>
                <option value="bookmarked">Bookmarked</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="fc-topic">Topic</Label>
              <Select id="fc-topic" value={filters.topicId} onChange={(e) => setFilters({ ...filters, topicId: e.target.value })}>
                <option value="">All topics</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="fc-diff">Difficulty</Label>
              <Select id="fc-diff" value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}>
                <option value="">Any</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </Select>
            </div>
          </div>
          {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" loading={busy} onClick={() => start()}>
              {resumable ? "Start new session" : "Start studying"}
            </Button>
            <Link href="/flashcards/custom" className={buttonClasses("ghost", "lg")}>My custom cards</Link>
          </div>
          {resumable ? <p className="mt-3 text-xs text-muted">Starting a new session resumes the unfinished one until it is complete or expires after 12 hours.</p> : null}
        </Card>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <EmptyState
        title="Session complete"
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setResumable(null); setPhase("setup"); }}>Study more</Button>
            <Link href="/dashboard" className={buttonClasses("secondary")}>Back to dashboard</Link>
          </div>
        }
      >
        <p>
          You reviewed {Object.keys(rated).length} card{Object.keys(rated).length === 1 ? "" : "s"}: {tally.AGAIN} again, {tally.HARD} hard,{" "}
          {tally.GOOD} good, {tally.EASY} easy. Each one is scheduled for its next review.
        </p>
      </EmptyState>
    );
  }

  if (!card) return null;
  const reviewedCount = Object.keys(rated).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted">
        <span>
          Card {index + 1} of {cards.length} <span className="text-muted/80">— {reviewedCount} rated</span>
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => move(-1)} disabled={index === 0} aria-label="Previous card">
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => move(1)} disabled={index >= cards.length - 1} aria-label="Next card">
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="[perspective:1600px]">
        <div className="card-flip relative grid" data-flipped={flipped}>
          <Card className="card-face col-start-1 row-start-1 flex min-h-[340px] flex-col p-6 sm:p-10" aria-hidden={flipped}>
            <CardMeta card={card} onBookmark={toggleBookmark} />
            <p className="mt-6 text-xl leading-snug font-medium sm:text-2xl">{card.prompt}</p>
            {card.scenario ? <p className="mt-4 text-muted">{card.scenario}</p> : null}
            {card.codeExample ? <div className="mt-5"><CodeBlock code={card.codeExample} /></div> : null}
            <div className="mt-auto pt-8">
              <Button variant="secondary" size="lg" className="w-full" onClick={() => setFlipped(true)} tabIndex={flipped ? -1 : 0}>
                Show answer <span className="text-xs text-muted">(Space)</span>
              </Button>
            </div>
          </Card>

          <Card className="card-face card-back col-start-1 row-start-1 flex min-h-[340px] flex-col p-6 sm:p-10" aria-hidden={!flipped}>
            <CardMeta card={card} onBookmark={toggleBookmark} />
            <p className="mt-6 text-sm text-muted">{card.prompt}</p>
            <p className="mt-3 text-lg leading-relaxed font-medium">{card.answer}</p>
            <p className="mt-4 max-w-[72ch] leading-relaxed text-muted">{card.explanation}</p>
            {card.codeExample ? <div className="mt-5"><CodeBlock code={card.codeExample} /></div> : null}
            <div className="mt-auto pt-8">
              <p className="mb-2 text-sm text-muted">How well did you recall it?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RATINGS.map((r) => (
                  <button
                    key={r.rating}
                    type="button"
                    disabled={busy || !flipped}
                    tabIndex={flipped ? 0 : -1}
                    onClick={() => rate(r.rating)}
                    className={cn("flex flex-col items-center rounded-lg border px-3 py-2.5 text-sm transition-colors disabled:opacity-50", r.tone)}
                  >
                    <span className="font-semibold">{r.label}</span>
                    <span className="text-xs text-muted">{intervalLabel(card, r.rating)}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Keys 1–4 rate, arrows move between cards.</p>
            </div>
          </Card>
        </div>
      </div>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
    </div>
  );
}

function CardMeta({ card, onBookmark }: { card: CardData; onBookmark: () => void }) {
  const due = card.progress?.nextReviewAt ? new Date(card.progress.nextReviewAt) : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{card.topic.title}</Badge>
        <DifficultyBadge value={card.difficulty} />
        {card.type !== "FLASHCARD" ? <Badge>{typeLabel(card.type)}</Badge> : null}
        {!card.progress ? <Badge tone="accent">New</Badge> : card.progress.lastCorrect === false ? <Badge tone="bad">Missed last time</Badge> : due && due <= new Date() ? <Badge tone="accent">Due</Badge> : null}
        {card.isCustom ? <Badge>Custom</Badge> : null}
        <button type="button" onClick={onBookmark} className="ml-auto rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-pressed={card.bookmarked} aria-label={card.bookmarked ? "Remove bookmark" : "Bookmark this question"}>
          {card.bookmarked ? <BookmarkCheck className="size-5 text-accent" aria-hidden /> : <Bookmark className="size-5" aria-hidden />}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <TeachMeLink lessonId={card.lessonId} returnTo="/flashcards" />
        <UnfamiliarButton questionId={card.id} source="FLASHCARD" />
      </div>
    </div>
  );
}
