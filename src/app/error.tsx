"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">This page failed to load</h1>
      <p className="text-muted">
        The server hit an unexpected error. Try again; if it keeps happening, quote reference{" "}
        <code className="font-mono text-sm">{error.digest ?? "unknown"}</code> when reporting it.
      </p>
      <Button className="self-start" onClick={reset}>Try again</Button>
    </main>
  );
}
