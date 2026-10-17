import type { Metadata } from "next";
import Link from "next/link";
import { listTracks } from "@/server/services/content.service";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Learning tracks" };

export default async function TracksPage() {
  const tracks = await listTracks();
  return (
    <>
      <PageHeader title="Learning tracks" description="Each track is a curriculum of topics, lessons and questions. Backend is available now." />
      <ul className="grid gap-4 md:grid-cols-2">
        {tracks.map((t) => (
          <li key={t.id}>
            {t.comingSoon ? (
              <Card className="h-full p-6 opacity-70">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{t.title}</h2>
                  <Badge>Coming soon</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">{t.description}</p>
              </Card>
            ) : (
              <Link href={`/tracks/${t.slug}`} className="block h-full">
                <Card className="h-full p-6 transition-colors hover:border-accent">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{t.title}</h2>
                    <Badge tone="accent">{t.topicCount} topics</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{t.description}</p>
                </Card>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
