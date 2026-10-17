# Testing status

This project was built in a sandbox where the npm registry was blocked by network policy, so `npm install` could not run. Everything that could be executed without the project's dependencies **was** executed; everything else is written and reviewed but **has not run yet**. This file says which is which, so nothing is claimed that was not observed.

Build environment: Node 22.22, TypeScript 6.0, PostgreSQL 16, Linux. Date: 2026-10-16.

## Verified on the developer's Windows machine

Run separately from the sandbox above, against a real **Supabase** Postgres database (`DATABASE_URL`) on Windows. Date: 2026-10-17.

| What | Result |
| --- | --- |
| `npm install` | OK |
| `npm run db:deploy` | Both migrations applied cleanly to Supabase |
| `npm run db:seed` | Created 5 tracks, 22 topics, 168 questions and the seeded admin account |
| `npm run dev` | Dev server starts and serves the dashboard |
| `npm run test:core` | 126 unit tests passed |
| `npm run test:db` | 27 SQL constraint tests passed |

Not yet run on this machine: `npm run typecheck`, `npm run lint`, `npm test` (integration), `npm run build`, `npm run test:e2e`. See [README.md](README.md#project-status) for the current status table.

## Verified — executed and passed

| What | How it was run | Result |
| --- | --- | --- |
| Adaptive engine unit tests (selection modes, randomisation, recency avoidance, mistake prioritisation, due reviews, weak topics, topic caps, per-user isolation, option shuffling) | `npm run test:core` (node:test via a Vitest-compatible shim) | 26 passed |
| Spaced-repetition scheduler and progress transitions | same | 14 passed |
| Server-side grading, answer-key hiding, rubric keyword coverage | same | 14 passed |
| Question validation and near-duplicate detection | same | 17 passed |
| AI client, generation pipeline and evaluation parsing (with a fake model: key handling, error hygiene, JSON extraction, duplicate/invalid rejection, prompt-injection fencing) | same | 17 passed |
| Analytics (streaks incl. time zones, topic ranking, null accuracy for new users), review queue, rate limiter, PRNG | same | 19 passed |
| Question bank: counts, validity, unique keys, no near-duplicates, every key grades correct, every model answer covers its rubric | same + `npm run content:check` | 7 passed; 168 questions, 0 failures |
| API request schemas (Zod) — **under both Zod 3.25 and Zod 4** | same, against the real `zod` package | 12 passed on each |
| Whole engine, content and scripts type-check (strict, `noUncheckedIndexedAccess`) | `tsc` with real `@types/node` | 0 errors |
| Migrations apply to a fresh PostgreSQL 16 database | `psql -f` on both migration files | OK |
| Database constraints (unique emails, global/private dedupe scopes, one progress row per user/question, SRS sanity CHECKs, duplicate quiz answers, idempotency keys, bookmarks, FKs, cascades on user delete, SET NULL links) | `tests/db/constraints.sql` | 27 passed |
| Prisma schema ↔ migration SQL equivalence | scripted cross-check of every column (type + nullability), unique, index and FK | 16 tables, 0 mismatches |
| Seed data loads into the real schema and is idempotent | `scripts/seed-sql.ts` output applied twice | 168 questions / 22 topics / 22 lessons / 5 tracks, unchanged on second run |
| Progress-row upsert + `FOR UPDATE` lock serialises concurrent writers | two concurrent `psql` transactions | second waited for the first, single row |
| Client components never import server-only code at runtime | scripted import scan of all 16 client files | clean |

Bugs found and fixed by this verification (so they will not reach you):

- New-questions mode could return already-seen questions and Weak mode could under-sample missed ones — fixed with explicit priority tiers.
- The per-topic cap ignored picks made in the same sampling pass.
- Under Zod 4, `.partial()` re-applies defaults, so admin PATCH requests would have silently unpublished tracks and reset ordering — replaced with explicit update schemas, with a regression test.
- Four seed scenarios whose own model answer failed its rubric (stemming and keyword gaps).

## Written but not yet executed

These need `npm install` (and for some, a database) on your machine. Run them in this order the first time; CI runs all of them on every push.

| What | Command | Notes |
| --- | --- | --- |
| Full-project type check | `npm run typecheck` | Pre-checked against hand-written stubs for Next.js, Prisma, Auth.js and React: no errors other than ones caused by the untyped stubs themselves. Real types may still surface issues. |
| Lint | `npm run lint` | Not run. |
| Prisma client generation and drift check | `npm install`, then the CI `migrate diff` step | Structural equivalence was checked by script, not by Prisma itself. |
| Prisma seed script | `npm run db:seed` | Its data was verified via the SQL path above; the Prisma code path has not run. |
| Integration tests (16) — quiz flow, answer-key hiding, duplicate and concurrent submissions, ownership, END-mode results, retry, adaptive selection with persisted history, recency avoidance, option shuffling, idempotent reviews, session resume, private custom cards, AI pipeline with canned output, import dry run, interview reveal, analytics for new users | `npm run db:test:migrate`, then `npm test` | Written against the real services; not executed. |
| Next.js build and runtime (pages, route handlers, middleware, Auth.js sign-in) | `npm run build`, `npm run dev` | Not executed. Auth.js is v5 (`next-auth@5` beta line), pinned to known APIs. |
| End-to-end tests (6 flows × desktop and mobile) | `npm run test:e2e` | Not executed. |
| Responsive layout and visual review | manual | Not viewed in a browser. |
| Live AI provider calls | set `AI_API_KEY` | Only exercised with a fake `fetch`. |
| Deployment | see DEPLOYMENT.md | Not deployed (no credentials). |

## Pinned versions

Because current versions could not be looked up, dependencies are pinned to major lines with well-known APIs: Next.js 15.5, React 19.1, Prisma 6.16, Auth.js 5 (beta), Zod 4.1, Tailwind CSS 4.1, Vitest 3.2, Playwright 1.55, TypeScript 5.9. Upgrading to newer majors (for example Next.js 16 or Prisma 7) is a deliberate follow-up, not a drop-in change — see ROADMAP.md.
