# Full-Stack Academy

An interview-prep platform: spaced-repetition flashcards, adaptive quizzes, written interview scenarios, progress analytics and an admin area — built with Next.js, TypeScript, PostgreSQL and Prisma.

The **Backend Development** track is live today: 22 topics, 22 lessons and **169 questions** (90 flashcards, 46 objective quiz questions, 33 scenarios). **Frontend Development**, **Full-Stack Development**, **DevOps and Cloud** and **System Design** are listed in the curriculum as "coming soon" — their tracks exist in the schema and seed data, but have no published topics yet.

Every quiz is assembled fresh for you. Questions and answer order are shuffled per quiz, questions you answered recently are held back while alternatives exist, questions you got wrong come back first, and every answer feeds a per-user spaced-repetition schedule. You choose between **New questions**, **Review weak topics** and **Mixed practice**. When an OpenAI-compatible API key is configured, the app can also generate question variations and new interview scenarios — validated and de-duplicated before they can enter the question bank. Without a key, everything else works.

**Learn Mode** connects studying back to teaching: every flashcard, quiz question and interview scenario can say "Teach me this concept" (opens its lesson) or "I haven't learned this yet" (never counted wrong, excluded from the quiz score, and resolved once you complete the lesson). Lessons have a summary, explanation, a real-world example, a code example and common mistakes, plus their own practice questions and a prerequisite chain; the dashboard recommends what to study next from your own unfamiliar marks, recent misses and weak topics. The **HTTP Fundamentals and Status Codes** lesson is fully written; the rest of the Backend Development track's 22 topics get their structured lesson content in later batches.

> **Read [TESTING.md](TESTING.md) before relying on this build.** It lists exactly what has been verified and what still needs its first run in your setup.

---

## Project status

Verified on the developer's Windows machine. The app database (`npm install`, `db:deploy`, `db:seed`, `npm run dev`) runs against a real Supabase Postgres database; everything else below runs only against the local Docker database (see [TESTING.md](TESTING.md) for the full log — Learn Mode's migration has not yet been applied to Supabase).

| Area | Status |
| --- | --- |
| `npm install` | Done |
| `npm run db:deploy` (migrations, against Supabase) | Done — **not yet including the Learn Mode migration** |
| `npm run db:seed` (against Supabase) | Done |
| `npm run dev` | Done — serves the dashboard |
| `npm run typecheck` | Passing — 0 errors |
| `npm run lint` | Passing — 0 errors |
| Unit tests (`npm run test:core`) | Passing — 147 tests |
| Integration tests (`npm test`, local Docker DB) | Passing — 173 tests |
| SQL constraint tests (`npm run test:db`, local Docker DB) | Passing — 38 checks |
| `npm run build` | Passing |
| End-to-end tests (`npm run test:e2e`, local Docker DB) | 13–14 of 14 pass per run (desktop + mobile) — one intermittent, pre-existing issue still open; see TESTING.md |
| Deployment | Not deployed |

## Contents

- [Project status](#project-status)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start on Windows (VS Code)](#quick-start-on-windows-vs-code)
- [Quick start on macOS / Linux](#quick-start-on-macos--linux)
- [Configuration](#configuration)
- [Running the tests](#running-the-tests)
- [Everyday commands](#everyday-commands)
- [Optional AI features](#optional-ai-features)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Documentation map](#documentation-map)

## Features

| Area | Highlights |
| --- | --- |
| Curriculum | Backend Development track live: 22 topics, 22 lessons, **169 questions** (90 flashcards, 46 objective quiz questions, 33 scenarios). Frontend, Full-Stack, DevOps and Cloud, and System Design are coming soon. |
| Flashcards | Flip, rate Again / Hard / Good / Easy (buttons show the real next interval), bookmarks, filters, "questions I got wrong", resumable sessions, private custom cards. |
| Quizzes | Multiple choice, select-all, short answer, code reading, scenarios. Practice or test feedback, optional timer, server-side grading, retry missed questions. |
| Adaptive engine | Seeded randomisation, recency avoidance, mistake prioritisation, spaced repetition, topic-weakness detection, topic diversity caps — all per user. |
| Interviews | Written answers, model answer revealed after you commit, rubric self-assessment, keyword hints, optional AI feedback (clearly labelled). |
| Analytics | Accuracy, streak (in your time zone), study time, topic strengths and weaknesses, 30-day activity, 14-day review forecast, next-topic recommendation. Empty states for new users — nothing is invented. |
| Learn Mode | "Teach me this concept" from any flashcard, quiz question or interview scenario; "I haven't learned this yet" (never wrong, excluded from the score, resolved on completion); lessons with a real-world example, code example and common mistakes; prerequisite locking; a dashboard "Lessons to study" card ranked by your own signals. |
| Admin | Question editor, validated JSON import with dry run, AI draft review queue, curriculum and lesson editing (including prerequisites and linked practice questions). |

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Auth | Auth.js (`next-auth` 5 beta), credentials-based sessions |
| Database | PostgreSQL — **Supabase** for the app database, a local Docker Postgres for destructive tests |
| ORM / migrations | Prisma 6 |
| Validation | Zod 4 |
| Unit / integration tests | Vitest 3, plus a dependency-free `node:test` shim (`test:core`) |
| End-to-end tests | Playwright |
| Optional AI | Any OpenAI-compatible Chat Completions endpoint |

## Quick start on Windows (VS Code)

### 1. Install the prerequisites

- **Node.js 22 LTS** (20.18+ also works): <https://nodejs.org>. Check with `node -v`.
- **Git**: <https://git-scm.com/download/win>
- **Docker Desktop**: <https://www.docker.com/products/docker-desktop/> — only needed for `DATABASE_URL_TEST`, the local database used by destructive/integration tests. The app itself talks to Supabase.
- **VS Code** with the recommended extensions: ESLint, Prettier, Prisma, Tailwind CSS IntelliSense.

### 2. Open the project and install dependencies

Unzip (or clone) the project, open the folder in VS Code, then open a terminal (**Terminal → New Terminal**, PowerShell):

```powershell
cd full-stack-academy
npm install
```

`npm install` also runs `prisma generate`. Commit the generated `package-lock.json` — CI uses it.

### 3. Create your environment file

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Open `.env` and paste the printed value into `AUTH_SECRET`. Change `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (10+ characters) to the account you want as administrator.

Set `DATABASE_URL` to your **Supabase** project's connection string (Supabase dashboard → Project Settings → Database → Connection string). This is the app's real database — treat it like production data, not a scratch database.

Leave `DATABASE_URL_TEST` pointed at the **local Docker database** (`localhost:5434`, started in the next step). Never point `DATABASE_URL_TEST` at Supabase: it is wiped by integration and constraint tests.

### 4. Start the local test database

Only needed for `test:db`, `test` (integration) and `db:test:migrate`; the app itself uses Supabase, not this container. Make sure Docker Desktop is running, then:

```powershell
npm run db:up
```

This starts PostgreSQL 16 on `localhost:5434` (not the default 5432 — chosen to avoid colliding with a native PostgreSQL install on the same machine; see docker-compose.yml) and, on first start, creates `full_stack_academy_test` and `full_stack_academy_shadow`.

### 5. Create the schema and load the questions (on Supabase)

```powershell
npm run db:deploy
npm run db:seed
```

`db:deploy` applies the committed migrations to whatever `DATABASE_URL` points at — make sure that's your Supabase connection string. `db:seed` loads the curriculum and question bank and creates your admin account. Both are safe to run again.

### 6. Start the app

```powershell
npm run dev
```

Open <http://localhost:3000>, sign in with your admin email and password (or register a normal account), and start with a **New questions** quiz.

## Quick start on macOS / Linux

```bash
npm install
cp .env.example .env    # then set DATABASE_URL (Supabase), AUTH_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
npm run db:up            # local Docker DB, for DATABASE_URL_TEST only
npm run db:deploy        # applies migrations to DATABASE_URL (Supabase)
npm run db:seed          # seeds DATABASE_URL (Supabase)
npm run dev
```

## Configuration

All variables are documented in [`.env.example`](.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string for the app — **Supabase** in this project, with real data. In production, the transaction pooler (port 6543, `?pgbouncer=true&connection_limit=1`). |
| `DIRECT_URL` | production | Supabase session pooler (port 5432), used by `prisma migrate deploy` / `db:seed` — a transaction pooler can't hold the session-level connection migrations need. Locally, `DATABASE_URL` is already a direct connection, so this is unused. |
| `DATABASE_URL_TEST` | for tests | A separate, local Docker database for integration and constraint tests. **Its data is deleted** by the tests. Must never point at Supabase. |
| `AUTH_SECRET` | yes | Signs session tokens. 32+ random bytes. |
| `AUTH_TRUST_HOST` | production | `true` behind Vercel or a trusted proxy. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | for seeding | Admin account created by `db:seed` if it does not exist. |
| `AI_API_KEY` | no | Enables AI features. Leave empty to run without AI. Never exposed to the browser. |
| `AI_BASE_URL`, `AI_MODEL` | no | Any OpenAI-compatible Chat Completions endpoint. |
| `AI_AUTO_PUBLISH` | no | `true` publishes AI drafts that pass every automated check; default `false` requires admin approval. |
| `AI_GENERATION_HOURLY_LIMIT` | no | Generation requests per user per hour (default 20). |
| `REGISTER_RATE_LIMIT_PER_HOUR` | no | Registrations allowed per IP per hour (default **5**). Anti-abuse, not a usage cap — keep it low in production. Playwright's own `webServer` raises it for the e2e suite only; never raise it anywhere else. |

> **Prisma CLI commands use `DIRECT_URL`, not `DATABASE_URL`.** `migrate deploy`, `migrate dev`, `migrate reset` and `db push` all read `directUrl` from `prisma/schema.prisma`'s datasource block, which maps to `DIRECT_URL`. If you point Prisma at a local or test database — e.g. `DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate dev --create-only` — and only override `DATABASE_URL`, the command still falls through to `.env`'s `DIRECT_URL` and runs against Supabase. Always override **both** together.

## Running the tests

| Command | Needs | What it runs |
| --- | --- | --- |
| `npm run test:core` | Node only | 147 unit tests of the adaptive engine, scheduling, grading, validation, dedupe, AI pipeline, question bank and Learn Mode's pure logic (progress, prerequisites, unfamiliar marks, recommendations). Does not touch any database. |
| `npm run content:check` | Node | Validates every seed question, answer key and rubric, and checks for near-duplicates. Does not touch any database. |
| `npm run typecheck` | `npm install` | TypeScript across the whole project. |
| `npm run lint` | `npm install` | ESLint (Next.js rules). |
| `npm test` | `npm install`; local Docker DB | Vitest: all unit tests plus integration tests against `DATABASE_URL_TEST` (173 tests, including Learn Mode's lesson/prerequisite/unfamiliar-mark flows) — **never run this against Supabase.** |
| `npm run test:db` | local Docker DB | SQL tests proving the database constraints (38 checks) against `DATABASE_URL_TEST`. Set `PSQL=local` to use a local `psql`. |
| `npm run test:e2e` | built app + seeded DB | Playwright: sign-in redirects, flashcards with resume, all three quiz modes, interview without AI, admin protection, and the Learn Mode flow (unfamiliar → recommended → teach-me → practice → complete) — on desktop and mobile viewports. Builds and runs the app via `npm run start`, which must be the **standalone** server (see Troubleshooting) — set `DATABASE_URL` to the local Docker database first, never Supabase. |

First-time setup for the local test database and browser tests:

```powershell
npm run db:up                    # local Docker Postgres, for DATABASE_URL_TEST
npm run db:test:migrate          # apply migrations to the test database
npm run test:db                  # constraint tests
npm test                         # unit + integration (against DATABASE_URL_TEST)
npx playwright install chromium  # one time
npm run build
npm run test:e2e
```

## Everyday commands

| Command | Description |
| --- | --- |
| `npm run dev` | Development server on port 3000. |
| `npm run build` / `npm start` | Production build / serve it. `npm start` runs `scripts/start-standalone.mjs`, not `next start` directly — see Troubleshooting. |
| `npm run db:studio` | Browse the database in Prisma Studio — points at whatever `DATABASE_URL` is set to; double-check before editing data. |
| `npm run db:migrate` | **Never run against Supabase.** Creates and applies a new migration from local schema changes (`prisma migrate dev`); only safe against a disposable local/test database. |
| `npm run db:reset` | **Never run against Supabase.** Drops and recreates the target database, then re-seeds. **Deletes all data.** Only ever point this at `DATABASE_URL_TEST`. |
| `npm run format` | Prettier. |

## Optional AI features

Set `AI_API_KEY` (plus `AI_BASE_URL` / `AI_MODEL` for non-OpenAI providers) and restart. You then get:

- **"Generate an AI variation"** on quiz results — a new question that tests the same concept with a different situation.
- **"Generate a new AI scenario"** on Interview practice.
- **"Get AI feedback"** on interview answers — scores for correctness, completeness, reasoning and clarity, missing concepts, and an improved answer. Always labelled as AI-generated.

Every generated question passes structural validation, an answer-key consistency check, a ban on position-dependent options ("all of the above" breaks when answers are shuffled), and near-duplicate detection against the bank before it is queued. It reaches learners only after admin approval (**Admin → AI drafts**) or, with `AI_AUTO_PUBLISH=true`, automatically — approval re-checks everything against the bank as it is at that moment. Automated checks cannot verify technical accuracy, so review drafts before approving.

## Project structure

```
content/          Curriculum, lessons and the 169-question bank (seed data)
prisma/           schema.prisma, migrations, seed script
src/app/          Next.js App Router: (auth), (app) dashboard/curriculum/flashcards/quizzes/interviews/
                  learn/review-queue/progress/settings/admin route groups, and API routes (incl. /api/learn)
src/components/   Shared UI (shell/nav, forms, cards, learn/, etc.)
src/lib/          Adaptive engine (selection, SRS, grading, validation, dedupe), AI client, Learn Mode's
                  pure logic (learn/progress, prerequisites, unfamiliar, recommendations), validation schemas
src/server/       Services (quiz, flashcards, interviews, generation, analytics, admin, learn) and the HTTP wrapper
scripts/          Content checks, core-test runner, DB constraint test runner, SQL seed, standalone server start
tests/            Vitest unit/integration tests, Playwright e2e specs, SQL constraint tests
docker/           init-test-db.sql — creates the local test/shadow databases on first container start
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel + Supabase and for the Docker image. Not yet deployed. In short: set `DATABASE_URL` to Supabase's transaction pooler (port 6543, `?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` to its session pooler (port 5432, used for migrations and seeding) as Vercel env vars; `prisma/schema.prisma` already declares `directUrl`, and `vercel.json` pins functions to the `pdx1` region to match the database.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Environment variable not found: DATABASE_URL` (or similar "missing `.env`" errors) | You haven't created `.env` yet. Run `Copy-Item .env.example .env` (Windows) or `cp .env.example .env` (macOS/Linux), then fill in `DATABASE_URL` (Supabase) and `AUTH_SECRET`. |
| `Can't reach database server` | Check `DATABASE_URL` — for the app this should be your Supabase connection string, not `localhost`. For `DATABASE_URL_TEST`, start Docker Desktop and run `npm run db:up`. |
| `The table "public.Question" does not exist` | Run `npm run db:deploy` against the database `DATABASE_URL` currently points at. |
| Sign-in fails right after setup | Run `npm run db:seed` and use `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, or register a new account. |
| `MissingSecret` / auth errors | Set `AUTH_SECRET` in `.env` and restart `npm run dev`. |
| `prisma migrate dev` reports drift | The committed SQL is the source of truth. Never run `db:migrate` or `db:reset` against Supabase — point them only at `DATABASE_URL_TEST` or a disposable local database. |
| Integration tests are skipped | Set `DATABASE_URL_TEST` to the local Docker database (not Supabase) and run `npm run db:test:migrate`. |
| PowerShell blocks `npm` scripts | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |
| Garbled characters like `â€”` instead of an em dash in a doc or source file | A text edit was saved with the wrong encoding (commonly from piping through `Get-Content`/`Set-Content` in PowerShell). Re-save the file as UTF-8 without a BOM; don't edit text files through PowerShell's `Get-Content`/`Set-Content` cmdlets. |
| `npm start` / `test:e2e`'s built-in server warns `"next start" does not work with "output: standalone"` or serves a page missing its styles | `next.config.ts` sets `output: "standalone"` (needed for the Docker image), which plain `next start` cannot serve correctly. `npm run start` now runs `scripts/start-standalone.mjs` instead, which copies the static assets next to the standalone server first, then starts it — the same thing the Dockerfile does. Run `npm run build` again if you still see this after pulling changes. |
| Port 5432 already in use when running `npm run db:up` | A native PostgreSQL install on the same machine is likely already bound to it. This project's `docker-compose.yml` uses **5434** for exactly this reason — check nothing else is also using that port. |

## Documentation map

- [TESTING.md](TESTING.md) — what has been verified and what has not.
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, the adaptive engine, scheduling, AI pipeline, security decisions.
- [DATABASE.md](DATABASE.md) — schema, relationships, constraints.
- [API.md](API.md) — endpoint reference.
- [DEPLOYMENT.md](DEPLOYMENT.md) — production setup.
- [ROADMAP.md](ROADMAP.md) — checklist and future work.
- [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md) — current state for the next developer or coding assistant.
