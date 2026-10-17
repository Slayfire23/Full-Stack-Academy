import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { getInterview } from "@/server/services/interview.service";
import { HttpError } from "@/server/http";
import { PageHeader } from "@/components/ui/primitives";
import { InterviewSession } from "@/components/interview/session";

export default async function InterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const session = await getInterview(user.id, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader title={session.topic?.title ?? "Interview practice"} description="Answer first, then compare. Revising an answer is encouraged." />
      <InterviewSession initial={session} />
    </>
  );
}
