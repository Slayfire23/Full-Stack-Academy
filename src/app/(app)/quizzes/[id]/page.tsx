import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { getQuizView } from "@/server/services/quiz.service";
import { HttpError } from "@/server/http";
import { QuizRunner } from "@/components/quiz/runner";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const quiz = await getQuizView(user.id, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  if (quiz.status !== "IN_PROGRESS") redirect(`/quizzes/${id}/results`);
  return <QuizRunner initial={quiz} />;
}
