# Handoff — current state

_Last updated: 2026-10-17. Read TESTING.md first._

## State in one paragraph

Full-Stack Academy is fully written: schema + migrations, adaptive engine, 168-question bank, services, 45 API routes, all pages, Vitest/Playwright tests, CI, Dockerfile and docs. **It has since been installed, migrated and seeded against a real Supabase database, and `npm run dev` serves the dashboard**, verified on the developer's Windows machine (see TESTING.md). Everything dependency-free was executed earlier in a sandbox: 126 unit tests (engine, scheduler, grading, validation, dedupe, AI pipeline, content, Zod schemas under Zod 3 and 4), 27 SQL constraint tests on PostgreSQL 16, a schema↔migration equivalence check, seed loading (idempotent), and a whole-app type check against package stubs.

## Database

The app's `DATABASE_URL` points at a **Supabase** Postgres database with real data — not a local/throwaway database. Never run `prisma migrate dev`, `prisma migrate reset`, `npm run db:reset` or `npm test` against it. Destructive or reset-style commands (`db:reset`, `db:migrate`, integration tests, `test:db`) must only ever target `DATABASE_URL_TEST`, which should stay pointed at the local Docker Postgres from `docker-compose.yml`.

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

## Decisions worth knowing

- `QuestionProgress` replaces the roadmap's `FlashcardProgress` so every mode shares one schedule (DATABASE.md).
- Update schemas are written out explicitly — never `.partial()` a schema with defaults (Zod 4 re-applies them).
- Answered questions are unpublished, not deleted, to protect history.
- AI drafts never reach learners without passing validation and approval (or `AI_AUTO_PUBLISH`).
- Dependencies are pinned to Next 15.5 / Prisma 6.16 / Auth.js 5 beta — upgrades are separate work.
- Test runner shim: `npm run test:core` runs the unit tests via node:test without npm install (`tsconfig.core.json` maps `vitest` to `tests/shim/vitest.ts`). Keep unit tests to the matcher subset in the shim, or extend the shim.

## Blockers

- Deployment needs database and hosting credentials (DEPLOYMENT.md).
- No live AI provider has been exercised.
