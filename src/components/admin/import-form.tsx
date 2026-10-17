"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge, Card, ErrorNote, Label, Select, Textarea } from "@/components/ui/primitives";

interface Report {
  dryRun: boolean;
  written: number;
  summary: Record<string, number>;
  results: { index: number; externalKey?: string; status: string; errors?: string[]; warnings?: string[] }[];
}

const EXAMPLE = `{
  "questions": [
    {
      "externalKey": "http-900",
      "topicSlug": "http",
      "type": "SHORT_ANSWER",
      "difficulty": "BEGINNER",
      "prompt": "Which status code means the resource was permanently moved?",
      "answer": "301 Moved Permanently",
      "explanation": "301 tells clients and search engines to update their links; 308 is the method-preserving equivalent.",
      "answerData": { "kind": "SHORT_ANSWER", "acceptedAnswers": ["301", "301 Moved Permanently"] },
      "tags": ["http", "status-codes"]
    }
  ]
}`;

export function ImportForm() {
  const [text, setText] = useState(EXAMPLE);
  const [onExisting, setOnExisting] = useState("skip");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    setError(null);
    let parsed: { questions?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("The file is not valid JSON.");
      return;
    }
    setBusy(true);
    try {
      setReport(await api<Report>("/api/admin/import", { body: { ...parsed, dryRun, onExisting } }));
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}${e.details ? `: ${JSON.stringify(e.details)}` : ""}` : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-6">
        <div>
          <Label htmlFor="imp-file">Load a JSON file</Label>
          <input id="imp-file" type="file" accept="application/json,.json" className="text-sm" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setText(await file.text()); }} />
        </div>
        <div>
          <Label htmlFor="imp-json">Question bank JSON</Label>
          <Textarea id="imp-json" className="min-h-80 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        </div>
        <div className="max-w-xs">
          <Label htmlFor="imp-existing">When an externalKey already exists</Label>
          <Select id="imp-existing" value={onExisting} onChange={(e) => setOnExisting(e.target.value)}>
            <option value="skip">Skip it</option>
            <option value="update">Update it</option>
          </Select>
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="flex gap-2">
          <Button variant="secondary" loading={busy} onClick={() => run(true)}>Validate (dry run)</Button>
          <Button loading={busy} onClick={() => run(false)} disabled={!report?.dryRun || (report.summary.created ?? 0) + (report.summary.updated ?? 0) === 0}>Import valid rows</Button>
        </div>
        <p className="text-xs text-muted">Run a dry run first. Every row is checked with the same validator and duplicate detector used for AI-generated questions.</p>
      </Card>
      <Card className="p-6">
        <h2 className="font-semibold">Report</h2>
        {!report ? (
          <p className="mt-2 text-sm text-muted">Validate the file to see a row-by-row report.</p>
        ) : (
          <>
            <p className="mt-2 text-sm">
              {report.dryRun ? "Dry run — nothing written." : `${report.written} rows written.`}{" "}
              {Object.entries(report.summary).map(([k, v]) => `${v} ${k}`).join(", ")}
            </p>
            <ul className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
              {report.results.map((r) => (
                <li key={r.index} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted">Row {r.index + 1}</span>
                    {r.externalKey ? <span>{r.externalKey}</span> : null}
                    <Badge tone={r.status === "created" || r.status === "updated" ? "good" : r.status === "skipped" ? "neutral" : "bad"}>{r.status}</Badge>
                  </div>
                  {r.errors?.map((e) => <p key={e} className="mt-1 text-bad">{e}</p>)}
                  {r.warnings?.map((w) => <p key={w} className="mt-1 text-accent">{w}</p>)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
