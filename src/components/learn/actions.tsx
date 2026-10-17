"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, HelpCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Opens the linked lesson for a question, if it has one — otherwise renders nothing. */
export function TeachMeLink({ lessonId, returnTo, className }: { lessonId: string | null; returnTo: string; className?: string }) {
  if (!lessonId) return null;
  return (
    <Link
      href={`/learn/${lessonId}?return=${encodeURIComponent(returnTo)}`}
      className={cn("inline-flex items-center gap-1.5 text-sm text-accent hover:underline", className)}
    >
      <BookOpen className="size-3.5" aria-hidden /> Teach me this concept
    </Link>
  );
}

type UnfamiliarSource = "FLASHCARD" | "QUIZ" | "INTERVIEW";

/**
 * "I haven't learned this yet": records an ungraded, no-penalty outcome and surfaces the
 * lesson it belongs to (if any) via onMarked. Never counts as incorrect anywhere.
 */
export function UnfamiliarButton({
  questionId,
  source,
  quizAttemptId,
  disabled,
  onMarked,
  className,
}: {
  questionId: string;
  source: UnfamiliarSource;
  quizAttemptId?: string;
  disabled?: boolean;
  onMarked?: (lessonId: string | null) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [marked, setMarked] = useState(false);

  async function mark() {
    setBusy(true);
    try {
      const res = await api<{ marked: boolean; lessonId: string | null }>("/api/learn/unfamiliar", {
        body: { questionId, source, quizAttemptId },
      });
      setMarked(true);
      onMarked?.(res.lessonId);
    } catch {
      // Best-effort: leave the button in place so the learner can retry.
    } finally {
      setBusy(false);
    }
  }

  if (marked) return <span className={cn("text-sm text-muted", className)}>Marked — it won&apos;t count against you, and we&apos;ll recommend the lesson.</span>;
  return (
    <Button type="button" variant="ghost" size="sm" loading={busy} disabled={disabled} onClick={mark} className={cn("gap-1.5", className)}>
      <HelpCircle className="size-4" aria-hidden /> I haven&apos;t learned this yet
    </Button>
  );
}
