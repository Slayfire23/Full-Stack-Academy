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

## Learn Mode verification (2026-10-17, local Docker database — not yet applied to Supabase)

Learn Mode's schema, services, API, UI and content were built and verified entirely against the local Docker database (`DATABASE_URL_TEST`/`DATABASE_URL` both pointed at `localhost:5434`). The migration has been reviewed and approved but has **not** been applied to Supabase, committed, or pushed.

| What | Result |
| --- | --- |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors |
| `npm run test:core` | 147 unit tests passed (126 original + 21 new: lesson progress, prerequisite cycles/locking/ordering, unfamiliar-mark semantics, recommendation ranking) |
| `npm run content:check` | 169 questions (90 flashcards, 46 objective, 33 scenarios), 0 failures, 0 near-duplicates |
| `npm run test:db` | 38 checks passed (27 original + 11 new: prerequisite self-reference, understanding range, practice-counter sanity, unfamiliar-mark uniqueness, lesson-related cascades) |
| `npm test` (integration) | 173 tests passed (142 original + more than 10 new, incl. two added on review: re-marking a resolved unfamiliar mark reactivates it; marking unfamiliar after already answering a quiz question is a no-op) |
| `npm run build` | Succeeds |
| `npm run test:e2e` (desktop + mobile, local Docker DB) | 13–14 of 14 pass per run across 6 runs. The admin-protection test passed in **every** run after the middleware fix below. The remaining, intermittent failure is a separate, newly-found issue — see below. |

Real bugs found and fixed during this work (none were pre-existing *known* issues — all newly discovered while verifying Learn Mode end to end):

- `next start` cannot serve a Next.js app built with `output: "standalone"` — it warned and served pages missing their static assets. This is why `test:e2e` had apparently never been run successfully before. Fixed by making `npm start` run `scripts/start-standalone.mjs` (copies static assets next to the standalone server, mirroring the Dockerfile, then starts it).
- `finishQuiz`/`getResults` only excluded "I haven't learned this yet" answers from the *correct* count, not from the score's denominator — which would have silently lowered scores for using the feature as designed. Fixed in `src/server/services/quiz.service.ts`.
- `/admin/**` and `/tracks` queried the database with no per-page auth check during `next build`'s static-generation pass (no session exists then), crashing the build. Fixed by marking the `(app)` and `admin` layouts `force-dynamic`.
- Admin pages returned HTTP 200 (with the correct "not found" content) instead of 404 for non-admins, because `notFound()` thrown from a layout races with the `(app)` root's `loading.tsx` Suspense boundary and with pages rendering in parallel with their layout. **Fixed and confirmed stable**: a role check in `src/middleware.ts` returns a flat 404 before any rendering, and `requireAdminPage()` is called at the top of the admin layout and every admin page as defense in depth.
- Running the desktop and mobile e2e projects as separate parallel workers (Playwright's default) made an unrelated, pre-existing timing issue worse, since both share one webServer and one persistent database with no reset between tests. Set `workers: 1` in `playwright.config.ts`.
- **Open, not yet root-caused**: with `workers: 1`, roughly 1 run in 2 still has a single test fail with a Playwright "strict mode violation" reporting two identical DOM elements for one static label (e.g. a quiz-mode radio label, a topic checkbox, a dashboard card, a heading) — a different element each time, never the same one twice in a row. Confirmed **not** specific to Learn Mode: it has hit the pre-existing "take a quiz" and "a new user sees empty states" tests as often as the new Learn Mode test. Captured network responses show the duplicated text appearing once in the rendered HTML and once in the embedded RSC data payload, which is the normal, expected shape — but Playwright's own accessibility snapshot at failure time reports two real `<label>`/`<h2>` elements, not one. Likely a hydration or Suspense-streaming timing issue (the `(app)/loading.tsx` boundary is a plausible contributor, per the same class of race as the admin-protection bug above), but confirming that needs a dedicated hydration-warning capture session, which this round of work didn't extend to. Three locator-ambiguity cases hit by this were hardened (`exact: true` / role-based locators) as a side effect, but that only fixes the assertion, not the underlying duplication.

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
