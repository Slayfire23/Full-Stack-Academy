import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { listInterviews } from "@/server/services/interview.service";
import { listTopics } from "@/server/services/content.service";
import { isAiConfigured } from "@/lib/ai/client";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { InterviewStart, RetryInterviewButton } from "@/components/interview/start";

export const metadata: Metadata = { title: "Interview practice" };

export default async function InterviewPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [{ topic }, topics, history] = await Promise.all([searchParams, listTopics(), listInterviews(user.id, undefined, 15)]);
  return (
    <>
      <PageHeader
        title="Interview practice"
        description="Answer realistic scenarios in writing, then compare with a model answer and check off the concepts you covered."
      />
      <InterviewStart topics={topics} initialTopic={topic} aiConfigured={isAiConfigured()} />
      {history.items.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Previous sessions</h2>
          <Card className="divide-y divide-border">
            {history.items.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
                <Link href={`/interview/${s.id}`} className="flex-1 hover:underline">
                  <span className="font-medium">{s.topic}</span>
                  <span className="ml-2 text-sm text-muted">{s.answered}/{s.questionCount} answered</span>
                </Link>
                <span className="text-sm text-muted">{s.startedAt.toLocaleDateString()}</span>
                {s.completedAt ? <Badge tone="good">Completed</Badge> : <Badge tone="accent">Open</Badge>}
                <RetryInterviewButton questionIds={s.questionIds} difficulty={s.difficulty} />
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
