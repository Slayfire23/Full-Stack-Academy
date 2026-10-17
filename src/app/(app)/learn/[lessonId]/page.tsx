import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { getLesson } from "@/server/services/learn.service";
import { HttpError } from "@/server/http";
import { LessonView } from "@/components/learn/lesson-view";

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: "Lesson" };
  const { lessonId } = await params;
  try {
    const data = await getLesson(user.id, lessonId);
    return { title: data.lesson.title };
  } catch {
    return { title: "Lesson" };
  }
}

export default async function LearnLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ return?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { lessonId } = await params;
  const { return: returnTo } = await searchParams;

  const data = await getLesson(user.id, lessonId).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });

  return <LessonView initial={data} returnTo={returnTo} />;
}
