import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  let next: string | undefined;
  try {
    next = callbackUrl ? new URL(callbackUrl, "http://local").pathname : undefined;
  } catch {
    next = undefined;
  }
  return <AuthForm mode="login" action={loginAction} next={next} />;
}
