"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge, Card, ErrorNote, Input } from "@/components/ui/primitives";

interface Draft {
  type?: string;
  prompt?: string;
  answer?: string;
  explanation?: string;
  answerData?: { options?: { id: string; text: string }[]; correctOptionIds?: string[]; modelAnswer?: string; acceptedAnswers?: string[]; keyConcepts?: { label: string }[] };
  rawExcerpt?: string;
}

export interface GeneratedItem {
  id: string;
  status: string;
  kind: string;
  draft: unknown;
  validation: unknown;
  rejectionReason: string | null;
  similarityScore: number | null;
  topic: string;
  sourceQuestion: { id: string; prompt: string } | null;
  model: string;
}

export function GeneratedReview({ item }: { item: GeneratedItem }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = (item.draft ?? {}) as Draft;
  const v = (item.validation ?? {}) as { errors?: string[]; warnings?: string[] };

  async function act(body: { action: "approve" } | { action: "reject"; reason: string }) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/generated/${item.id}`, { body });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">AI-generated</Badge>
        <Badge>{item.kind === "VARIATION" ? "Variation" : "Interview scenario"}</Badge>
        <Badge>{item.topic}</Badge>
        <Badge tone={item.status === "APPROVED" ? "good" : item.status === "REJECTED" ? "bad" : "neutral"}>{item.status.replace("_", " ").toLowerCase()}</Badge>
        <span className="text-xs text-muted">{item.model}{item.similarityScore !== null ? `, closest existing match ${Math.round(item.similarityScore * 100)}%` : ""}</span>
      </div>
      {item.sourceQuestion ? <p className="mt-3 text-sm text-muted">Variation of: {item.sourceQuestion.prompt}</p> : null}
      {d.prompt ? (
        <>
          <p className="mt-3 font-medium">{d.prompt}</p>
          {d.answerData?.options ? (
            <ul className="mt-2 space-y-1 text-sm">
              {d.answerData.options.map((o) => (
                <li key={o.id} className={d.answerData?.correctOptionIds?.includes(o.id) ? "text-good" : "text-muted"}>
                  {d.answerData?.correctOptionIds?.includes(o.id) ? "Correct: " : "Wrong: "}{o.text}
                </li>
              ))}
            </ul>
          ) : null}
          {d.answerData?.modelAnswer ? <p className="mt-2 text-sm"><span className="font-medium">Model answer: </span>{d.answerData.modelAnswer}</p> : <p className="mt-2 text-sm"><span className="font-medium">Answer: </span>{d.answer}</p>}
          {d.answerData?.keyConcepts ? <p className="mt-1 text-sm text-muted">Rubric: {d.answerData.keyConcepts.map((c) => c.label).join("; ")}</p> : null}
          <p className="mt-2 text-sm text-muted">{d.explanation}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">The model output could not be parsed. Excerpt: {d.rawExcerpt}</p>
      )}
      {v.errors?.length ? <div className="mt-3"><ErrorNote>{v.errors.join(" ")}</ErrorNote></div> : null}
      {v.warnings?.length ? <p className="mt-2 text-sm text-accent">{v.warnings.join(" ")}</p> : null}
      {item.rejectionReason && item.status === "REJECTED" ? <p className="mt-2 text-sm text-bad">Rejected: {item.rejectionReason}</p> : null}
      {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
      {item.status === "PENDING_REVIEW" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button loading={busy} onClick={() => act({ action: "approve" })}>Approve and publish</Button>
          <Input className="w-64" placeholder="Reason for rejecting" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Rejection reason" />
          <Button variant="secondary" disabled={reason.trim().length < 3 || busy} onClick={() => act({ action: "reject", reason })}>Reject</Button>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted">Approving re-runs validation and the duplicate check against the current bank. Verify technical accuracy yourself — automated checks cannot.</p>
    </Card>
  );
}
