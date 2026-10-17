import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui/primitives";
import { CurriculumManager } from "@/components/admin/curriculum";

export const metadata: Metadata = { title: "Curriculum — Admin" };

export default async function CurriculumPage() {
  const [tracks, topics] = await Promise.all([
    prisma.learningTrack.findMany({ orderBy: { order: "asc" } }),
    prisma.topic.findMany({ orderBy: [{ trackId: "asc" }, { order: "asc" }], include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, content: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Curriculum" description="Tracks, topics and lessons. New tracks start unpublished and appear as coming soon." />
      <CurriculumManager tracks={tracks} topics={topics} />
    </>
  );
}
