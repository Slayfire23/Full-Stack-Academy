import type { Metadata } from "next";
import { listTopics } from "@/server/services/content.service";
import { PageHeader } from "@/components/ui/primitives";
import { FlashcardStudy } from "@/components/flashcards/study";

export const metadata: Metadata = { title: "Flashcards" };

export default async function FlashcardsPage({ searchParams }: { searchParams: Promise<{ topic?: string; start?: string }> }) {
  const [{ topic, start }, topics] = await Promise.all([searchParams, listTopics()]);
  return (
    <>
      <PageHeader
        title="Flashcards"
        description="Recall the answer, then rate yourself honestly. Your ratings decide when each card comes back."
      />
      <FlashcardStudy topics={topics} initialTopic={topic} autoStart={start === "1"} />
    </>
  );
}
