import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { listCustomCards } from "@/server/services/flashcard.service";
import { listTopics } from "@/server/services/content.service";
import { PageHeader } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { CustomCards } from "@/components/flashcards/custom-cards";

export const metadata: Metadata = { title: "Custom flashcards" };

export default async function CustomCardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [cards, topics] = await Promise.all([listCustomCards(user.id), listTopics()]);
  return (
    <>
      <PageHeader title="Custom flashcards" description="Private cards you write yourself." actions={<Link href="/flashcards" className={buttonClasses("secondary")}>Back to studying</Link>} />
      <CustomCards cards={cards} topics={topics} />
    </>
  );
}
