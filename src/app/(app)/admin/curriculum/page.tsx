import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { requireAdminPage } from "@/server/session";
import { PageHeader } from "@/components/ui/primitives";
import { CurriculumManager } from "@/components/admin/curriculum";

export const metadata: Metadata = { title: "Curriculum — Admin" };

export default async function CurriculumPage() {
  await requireAdminPage();
  const [tracks, topics, allLessons] = await Promise.all([
    prisma.learningTrack.findMany({ orderBy: { order: "asc" } }),
    prisma.topic.findMany({
      orderBy: [{ trackId: "asc" }, { order: "asc" }],
      include: {
        lessons: {
          orderBy: { order: "asc" },
          include: {
            prerequisites: { select: { prerequisiteId: true, prerequisite: { select: { title: true } } } },
            questions: { where: { ownerId: null }, orderBy: { createdAt: "asc" }, select: { id: true, prompt: true, type: true } },
          },
        },
        questions: { where: { ownerId: null, lessonId: null }, orderBy: { createdAt: "asc" }, select: { id: true, prompt: true, type: true } },
      },
    }),
    prisma.lesson.findMany({ select: { id: true, title: true, topicId: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Curriculum" description="Tracks, topics and lessons. New tracks start unpublished and appear as coming soon." />
      <CurriculumManager tracks={tracks} topics={topics} allLessons={allLessons} />
    </>
  );
}
