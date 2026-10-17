import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { listTopics } from "@/server/services/content.service";
import { requireAdminPage } from "@/server/session";
import { PageHeader } from "@/components/ui/primitives";
import { QuestionEditor } from "@/components/admin/question-editor";

export default async function EditQuestion({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const topics = await listTopics();
  if (id === "new") return (<><PageHeader title="New question" /><QuestionEditor topics={topics} /></>);
  const q = await prisma.question.findFirst({ where: { id, ownerId: null } });
  if (!q) notFound();
  return (
    <>
      <PageHeader title="Edit question" description={q.externalKey ? `Key: ${q.externalKey}` : undefined} />
      <QuestionEditor
        topics={topics}
        initial={{
          id: q.id,
          topicId: q.topicId,
          type: q.type,
          difficulty: q.difficulty,
          prompt: q.prompt,
          answer: q.answer,
          explanation: q.explanation,
          answerData: q.answerData,
          codeExample: q.codeExample ?? "",
          scenario: q.scenario ?? "",
          tags: q.tags.join(", "),
          published: q.published,
        }}
      />
    </>
  );
}
