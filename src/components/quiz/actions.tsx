"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function RetryButtons({ quizId, hasIncorrect }: { quizId: string; hasIncorrect: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function retry(scope: "incorrect" | "all") {
    setBusy(scope);
    try {
      const res = await api<{ quizId: string }>(`/api/quizzes/${quizId}/retry`, { body: { scope } });
      router.push(`/quizzes/${res.quizId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the retry quiz.");
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasIncorrect ? <Button loading={busy === "incorrect"} onClick={() => retry("incorrect")}>Retry missed questions</Button> : null}
      <Button variant="secondary" loading={busy === "all"} onClick={() => retry("all")}>Retake all</Button>
      {error ? <span className="text-sm text-bad">{error}</span> : null}
    </div>
  );
}

/**
 * Ask the AI for a variation of a question. The result goes through validation and duplicate
 * checks, then into the review queue (or straight into the bank with AI_AUTO_PUBLISH=true).
 */
export function GenerateVariationButton({ questionId }: { questionId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  async function go() {
    setState("busy");
    try {
      const res = await api<{ status: string; rejectionReason: string | null }>("/api/generation", { body: { kind: "VARIATION", questionId } });
      setState("done");
      setMessage(
        res.status === "APPROVED"
          ? "AI variation added to the bank. It can appear in future quizzes."
          : res.status === "PENDING_REVIEW"
            ? "AI variation passed automated checks and is waiting for admin review."
            : `The AI draft was rejected by validation: ${res.rejectionReason ?? "unknown reason"}`,
      );
    } catch (e) {
      setState("error");
      setMessage(e instanceof ApiError ? e.message : "Generation failed.");
    }
  }
  if (state === "done" || state === "error") return <p className={state === "error" ? "text-sm text-bad" : "text-sm text-muted"} role="status">{message}</p>;
  return (
    <Button variant="ghost" size="sm" loading={state === "busy"} onClick={go}>
      <Sparkles className="size-4" aria-hidden /> Generate an AI variation
    </Button>
  );
}
