"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { fieldErrors, loginSchema, registerSchema } from "@/lib/validation/schemas";
import { registerUser } from "@/server/services/account.service";
import { HttpError } from "@/server/http";
import { limiters } from "@/server/limits";

export interface FormState {
  error?: string;
  fields?: Record<string, string>;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password.", fields: fieldErrors(parsed.error.issues) };
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeNext(formData.get("next")) });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      return { error: code === "rate_limited" ? "Too many attempts. Wait 15 minutes and try again." : "Email or password is incorrect." };
    }
    throw err; // Next.js redirect on success is thrown as an error and must propagate
  }
  return {};
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiters.register.check(ip).allowed) return { error: "Too many sign-ups from this network. Try again later." };
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Check the highlighted fields.", fields: fieldErrors(parsed.error.issues) };
  try {
    await registerUser(parsed.data);
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) return { error: err.message, fields: { email: err.message } };
    throw err;
  }
  await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirectTo: "/dashboard" });
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Only allow same-site relative redirects after login (prevents open redirects). */
function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}
