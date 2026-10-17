# Handoff — current state

_Last updated: 2026-10-17. Read TESTING.md first._

## State in one paragraph

Full-Stack Academy is fully written: schema + migrations, adaptive engine, 169-question bank (as of Learn Mode), services, 45+ API routes, all pages, Vitest/Playwright tests, CI, Dockerfile and docs. **It has since been installed, migrated and seeded against a real Supabase database, and `npm run dev` serves the dashboard**, verified on the developer's Windows machine (see TESTING.md). Everything dependency-free was executed earlier in a sandbox: 126 unit tests (engine, scheduler, grading, validation, dedupe, AI pipeline, content, Zod schemas under Zod 3 and 4), 27 SQL constraint tests on PostgreSQL 16, a schema↔migration equivalence check, seed loading (idempotent), and a whole-app type check against package stubs.

## Learn Mode (added 2026-10-17, not yet on Supabase)

Lessons gained structured fields (summary, explanation, real-world example, code example, common mistakes, level, minutes), plus `LessonPrerequisite`, `LessonProgress` and `UnfamiliarMark` tables and a `StudyKind.LESSON_PRACTICE` enum value — all additive, migration `prisma/migrations/20261017191658_learn_mode`. Pure logic in `src/lib/learn/*`, service in `src/server/services/learn.service.ts`, routes under `/api/learn/*` and `/api/admin/lessons/*/{prerequisites,questions}`, UI at `/learn/[lessonId]` plus "Teach me this concept" / "I haven't learned this yet" on flashcards, quiz questions and interview scenarios. Only the **HTTP Fundamentals and Status Codes** lesson has full structured content so far; the other 21 topics still only have their original plain `content`, which the UI falls back to. **The migration has been reviewed and approved but not yet applied to Supabase or committed** — it has only run against the local Docker database.

## Database

The app's `DATABASE_URL` points at a **Supabase** Postgres database with real data — not a local/throwaway database. Never run `prisma migrate dev`, `prisma migrate reset`, `npm run db:reset` or `npm test` against it. Destructive or reset-style commands (`db:reset`, `db:migrate`, integration tests, `test:db`) must only ever target `DATABASE_URL_TEST`, which should stay pointed at the local Docker Postgres from `docker-compose.yml` — **port 5434, not 5432** (a native PostgreSQL install commonly already owns 5432).

## First thing to do

```powershell
npm install
npm run typecheck; npm run lint
npm run db:up; npm run db:deploy; npm run db:seed
npm run db:test:migrate; npm run test:db; npm test
npm run build; npx playwright install chromium; npm run test:e2e
```

Expect a small number of fixes from real type definitions (the stub check could not see Prisma result types). Areas most likely to need attention, in order: Auth.js v5 beta API details (`src/auth.ts`, `src/auth.config.ts`, server actions in `src/app/(auth)/actions.ts`), Prisma JSON typing casts in services, `next/font` availability at build time (needs network), Tailwind v4 class names in components.

## Where things are

| Need | File |
| --- | --- |
| Selection logic (modes, recency, tiers, sampling) | `src/lib/adaptive/selection.ts` |
| Spaced repetition | `src/lib/adaptive/srs.ts` |
| Grading / answer-key hiding | `src/lib/adaptive/grading.ts` |
| Question validation | `src/lib/adaptive/question-schema.ts` |
| Duplicate detection | `src/lib/adaptive/similarity.ts`, `text.ts` |
| AI generation + evaluation | `src/lib/ai/*`, `src/server/services/generation.service.ts` |
| Single write path for answers | `src/server/services/progress.service.ts` (`recordOutcome`) |
| Quiz lifecycle | `src/server/services/quiz.service.ts` |
| Request schemas | `src/lib/validation/schemas.ts` |
| Error/route wrapper | `src/server/http.ts` |
| Seed content | `content/*.ts` (validated by `npm run content:check`) |
| Lesson progress, prerequisites, unfamiliar marks, recommendations (pure) | `src/lib/learn/*` |
| Learn Mode orchestration | `src/server/services/learn.service.ts` |
| Admin protection (role check) | `src/middleware.ts` (before any rendering), `src/server/session.ts` (`requireAdminPage`, called by the admin layout and every admin page) |
| Registration rate limit | `src/server/limits.ts` (`REGISTER_RATE_LIMIT_PER_HOUR`, default 5/hour/IP; Playwright raises it for e2e only) |

## Decisions worth knowing

- `QuestionProgress` replaces the roadmap's `FlashcardProgress` so every mode shares one schedule (DATABASE.md).
- Update schemas are written out explicitly — never `.partial()` a schema with defaults (Zod 4 re-applies them).
- Answered questions are unpublished, not deleted, to protect history.
- AI drafts never reach learners without passing validation and approval (or `AI_AUTO_PUBLISH`).
- Dependencies are pinned to Next 15.5 / Prisma 6.16 / Auth.js 5 beta — upgrades are separate work.
- Test runner shim: `npm run test:core` runs the unit tests via node:test without npm install (`tsconfig.core.json` maps `vitest` to `tests/shim/vitest.ts`). Keep unit tests to the matcher subset in the shim, or extend the shim.
- Admin protection is layered on purpose: `src/middleware.ts` checks the JWT's `role` claim and returns a flat 404 for non-admins before any rendering starts; the admin layout and every admin page additionally call `requireAdminPage()`. The layout/page checks exist because Next.js streams a layout's children in parallel with the layout itself (there's a `(app)/loading.tsx` Suspense boundary), so a page that reaches the database on its own cannot rely only on an ancestor layout's `notFound()`.
- `npm start` runs `scripts/start-standalone.mjs`, not `next start` directly — `next.config.ts` sets `output: "standalone"` for the Docker image, and plain `next start` cannot serve that build correctly (missing static assets). The script copies them into place first, the same way the Dockerfile does.
- "I haven't learned this yet" marks resolve (not delete) on lesson completion, and re-marking an already-resolved one reactivates the same row (upsert, not a new row) — see `UnfamiliarMark` and `resolveMarksForLesson` in `src/lib/learn/unfamiliar.ts`.

## Blockers

- Deployment needs database and hosting credentials (DEPLOYMENT.md).
- No live AI provider has been exercised.
- Learn Mode's migration is approved but not yet applied to Supabase (see above).
- 21 of 22 Backend Development topics still need their structured Learn Mode lesson content (only HTTP Fundamentals has it); planned as later batches.
- `npm run test:e2e` has an intermittent, pre-existing, not-yet-root-caused flake: roughly 1 run in 2, one test fails on a Playwright "strict mode violation" reporting two identical DOM elements for one label/heading — a different element each time. Confirmed not specific to Learn Mode (hits old, unrelated tests too) and not a data bug (only 22 topics genuinely exist). Likely hydration/Suspense-streaming timing, same general class as the admin-protection race above, but unconfirmed — see TESTING.md's Learn Mode verification section before spending more time on it.
