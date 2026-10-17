import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { listTopics } from "@/server/services/content.service";
import { getSettings } from "@/server/services/account.service";
import { PageHeader } from "@/components/ui/primitives";
import { QuizSetup } from "@/components/quiz/setup";

export const metadata: Metadata = { title: "New quiz" };

export default async function NewQuizPage({ searchParams }: { searchParams: Promise<{ mode?: string; topic?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [{ mode, topic }, topics, settings] = await Promise.all([searchParams, listTopics(), getSettings(user.id)]);
  const initialMode = mode === "NEW" || mode === "WEAK" || mode === "MIXED" ? mode : undefined;
  return (
    <>
      <PageHeader title="New quiz" />
      <QuizSetup topics={topics} initialMode={initialMode} initialTopic={topic} defaultMode={settings.defaultSelectionMode} />
    </>
  );
}
