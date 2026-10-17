/**
 * Emits the curriculum + question bank as idempotent SQL (INSERT ... ON CONFLICT DO UPDATE).
 *
 *   npx tsx --tsconfig tsconfig.core.json scripts/seed-sql.ts > seed.sql
 *   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f seed.sql
 *
 * The normal path is `npm run db:seed` (Prisma). This script exists to verify seed content
 * against the real schema in environments without node_modules, and as a psql-only fallback.
 * It does not create the admin user (that needs bcrypt); register and promote instead.
 */
import { createHash } from "node:crypto";
import { allQuestions, curriculum, tracks } from "../content";
import { contentHash } from "../src/lib/adaptive/text";

const q = (v: string | null | undefined) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const arr = (xs: string[]) => (xs.length === 0 ? "ARRAY[]::TEXT[]" : `ARRAY[${xs.map(q).join(",")}]::TEXT[]`);
/** Deterministic ids so re-running produces the same rows. */
const id = (kind: string, key: string) => `seed_${kind}_${createHash("sha1").update(key).digest("hex").slice(0, 20)}`;

const out: string[] = ["BEGIN;"];

for (const t of tracks) {
  out.push(
    `INSERT INTO "LearningTrack"(id, slug, title, description, published, "order", "updatedAt") VALUES (${q(id("track", t.slug))}, ${q(t.slug)}, ${q(t.title)}, ${q(t.description)}, ${t.published}, ${t.order}, now())
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, published = EXCLUDED.published, "order" = EXCLUDED."order", "updatedAt" = now();`,
  );
}

const trackId = `(SELECT id FROM "LearningTrack" WHERE slug = ${q(curriculum.track.slug)})`;
curriculum.topics.forEach((t, i) => {
  out.push(
    `INSERT INTO "Topic"(id, "trackId", slug, title, description, "order", "updatedAt") VALUES (${q(id("topic", t.slug))}, ${trackId}, ${q(t.slug)}, ${q(t.title)}, ${q(t.description)}, ${i + 1}, now())
     ON CONFLICT ("trackId", slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, "order" = EXCLUDED."order", "updatedAt" = now();`,
  );
  const topicId = `(SELECT id FROM "Topic" WHERE slug = ${q(t.slug)} AND "trackId" = ${trackId})`;
  out.push(
    `INSERT INTO "Lesson"(id, "topicId", slug, title, content, "order", "updatedAt") VALUES (${q(id("lesson", t.slug))}, ${topicId}, ${q(t.lesson.slug)}, ${q(t.lesson.title)}, ${q(t.lesson.content)}, 1, now())
     ON CONFLICT ("topicId", slug) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, "updatedAt" = now();`,
  );
});

for (const item of allQuestions) {
  const topicId = `(SELECT id FROM "Topic" WHERE slug = ${q(item.topic)} AND "trackId" = ${trackId})`;
  const lessonId = `(SELECT l.id FROM "Lesson" l JOIN "Topic" t ON t.id = l."topicId" WHERE t.slug = ${q(item.topic)} AND l.slug = 'essentials')`;
  out.push(
    `INSERT INTO "Question"(id, "externalKey", "topicId", "lessonId", type, difficulty, prompt, answer, explanation, "answerData", "codeExample", scenario, tags, published, source, "contentHash", "dedupeScope", "updatedAt")
     VALUES (${q(id("q", item.externalKey))}, ${q(item.externalKey)}, ${topicId}, ${lessonId}, '${item.type}', '${item.difficulty}', ${q(item.prompt)}, ${q(item.answer)}, ${q(item.explanation)}, ${q(JSON.stringify(item.answerData))}::jsonb, ${q(item.codeExample)}, ${q(item.scenario)}, ${arr(item.tags)}, true, 'SEED', ${q(contentHash(item.prompt, item.answer))}, 'global', now())
     ON CONFLICT ("externalKey") DO UPDATE SET prompt = EXCLUDED.prompt, answer = EXCLUDED.answer, explanation = EXCLUDED.explanation, "answerData" = EXCLUDED."answerData", "codeExample" = EXCLUDED."codeExample", tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty, type = EXCLUDED.type, "contentHash" = EXCLUDED."contentHash", published = true, "updatedAt" = now();`,
  );
}

out.push("COMMIT;");
process.stdout.write(out.join("\n") + "\n");
