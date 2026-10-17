import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { getTrack } from "@/server/services/content.service";
import { HttpError } from "@/server/http";
import { Card, EmptyState, Meter, PageHeader } from "@/components/ui/primitives";

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const track = await getTrack(user.id, slug).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  if (track.comingSoon) {
    return (
      <>
        <PageHeader title={track.title} />
        <EmptyState title="This track is not available yet">{track.description}</EmptyState>
      </>
    );
  }
  return (
    <>
      <PageHeader title={track.title} description={track.description} />
      <ol className="grid gap-3 md:grid-cols-2">
        {track.topics.map((t, i) => (
          <li key={t.id}>
            <Link href={`/topics/${t.id}`} className="block h-full">
              <Card className="flex h-full flex-col gap-3 p-5 transition-colors hover:border-accent">
                <div className="flex gap-3">
                  <span className="mt-0.5 text-sm tabular-nums text-muted" aria-hidden>{i + 1}</span>
                  <div className="min-w-0">
                    <h2 className="font-semibold">{t.title}</h2>
                    <p className="mt-1 text-sm text-muted">{t.description}</p>
                  </div>
                </div>
                <div className="mt-auto pl-6">
                  <Meter value={t.seen} max={t.questionCount} label={`${t.title} questions seen`} tone="good" />
                  <p className="mt-1.5 text-xs text-muted">
                    {t.seen} of {t.questionCount} seen{t.mastered ? `, ${t.mastered} mastered` : ""}
                  </p>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
