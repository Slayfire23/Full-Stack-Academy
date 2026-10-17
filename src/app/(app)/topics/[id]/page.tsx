import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { getTopic } from "@/server/services/content.service";
import { HttpError } from "@/server/http";
import { Badge, Card, DifficultyBadge, PageHeader, typeLabel } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const topic = await getTopic(user.id, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const scenarios = topic.questionTypes.SCENARIO ?? 0;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <Link href={`/tracks/${topic.track.slug}`} className="hover:underline">{topic.track.title}</Link>
      </nav>
      <PageHeader
        title={topic.title}
        description={topic.description}
        actions={
          <>
            <Link href={`/quizzes/new?mode=MIXED&topic=${topic.id}`} className={buttonClasses("primary")}>Quiz this topic</Link>
            <Link href={`/flashcards?start=1&topic=${topic.id}`} className={buttonClasses("secondary")}>Flashcards</Link>
            {scenarios > 0 ? (
              <Link href={`/interview?topic=${topic.id}`} className={buttonClasses("secondary")}>Interview drill</Link>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          {topic.lessons.map((l) => (
            <article key={l.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{l.title}</h2>
                <DifficultyBadge value={l.level} />
                <Badge>{l.estimatedMinutes} min</Badge>
                {l.status === "COMPLETED" ? <Badge tone="good">Completed</Badge> : l.status === "IN_PROGRESS" ? <Badge tone="accent">In progress</Badge> : null}
                {l.locked ? <Badge tone="neutral">Locked</Badge> : null}
              </div>
              {l.locked ? (
                <p className="mb-3 text-sm text-muted">Recommended to learn {l.missingPrerequisites.map((p) => p.title).join(", ")} first.</p>
              ) : null}
              {l.summary ? <p className="mb-3 text-muted">{l.summary}</p> : null}
              <Markdown source={l.content} />
              <Link href={`/learn/${l.id}`} className={buttonClasses("secondary", "sm", "mt-3")}>
                Open lesson
              </Link>
            </article>
          ))}
        </div>
        <Card className="h-fit p-5">
          <h2 className="font-semibold">Questions in this topic</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {Object.entries(topic.questionTypes).map(([type, n]) => (
              <li key={type} className="flex justify-between gap-3">
                <span className="text-muted">{typeLabel(type)}</span>
                <span className="tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
