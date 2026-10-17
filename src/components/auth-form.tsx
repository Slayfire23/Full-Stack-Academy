"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorNote, Input, Label } from "@/components/ui/primitives";
import type { FormState } from "@/app/(auth)/actions";

type Field = { name: string; label: string; type: string; autoComplete: string; hint?: string };

export function AuthForm({
  mode,
  action,
  next,
}: {
  mode: "login" | "register";
  action: (state: FormState, data: FormData) => Promise<FormState>;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fields: Field[] =
    mode === "register"
      ? [
          { name: "name", label: "Name", type: "text", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters." },
        ]
      : [
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ];

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Sign in" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login" ? "Pick up where your review schedule left off." : "Your progress is private to your account."}
        </p>
      </div>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {fields.map((f) => (
        <div key={f.name}>
          <Label htmlFor={f.name}>{f.label}</Label>
          <Input
            id={f.name}
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            required
            aria-invalid={Boolean(state.fields?.[f.name]) || undefined}
            aria-describedby={state.fields?.[f.name] || f.hint ? `${f.name}-msg` : undefined}
          />
          {state.fields?.[f.name] ? (
            <p id={`${f.name}-msg`} className="mt-1 text-xs text-bad">{state.fields[f.name]}</p>
          ) : f.hint ? (
            <p id={`${f.name}-msg`} className="mt-1 text-xs text-muted">{f.hint}</p>
          ) : null}
        </div>
      ))}
      <Button type="submit" size="lg" loading={pending}>
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-sm text-muted">
        {mode === "login" ? (
          <>No account yet? <Link className="text-text underline underline-offset-4" href="/register">Create one</Link></>
        ) : (
          <>Already registered? <Link className="text-text underline underline-offset-4" href="/login">Sign in</Link></>
        )}
      </p>
    </form>
  );
}
