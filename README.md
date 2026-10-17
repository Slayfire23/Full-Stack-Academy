# Backend Academy

An interview-prep platform for backend developers: spaced-repetition flashcards, adaptive quizzes, written interview scenarios, progress analytics and an admin area — built with Next.js, TypeScript, PostgreSQL and Prisma.

Every quiz is assembled fresh for you. Questions and answer order are shuffled per quiz, questions you answered recently are held back while alternatives exist, questions you got wrong come back first, and every answer feeds a per-user spaced-repetition schedule. You choose between **New questions**, **Review weak topics** and **Mixed practice**. When an OpenAI-compatible API key is configured, the app can also generate question variations and new interview scenarios — validated and de-duplicated before they can enter the question bank. Without a key, everything else works.

> **Read [TESTING.md](TESTING.md) before relying on this build.** It lists exactly what was executed and passed in the build environment and what still needs its first run on your machine. The package registry was unreachable while this was written, so the Next.js/Prisma layer has not yet been installed, built or run.

---

## Contents

- [What's inside](#whats-inside)
- [Quick start on Windows (VS Code)](#quick-start-on-windows-vs-code)
- [Quick start on macOS / Linux](#quick-start-on-macos--linux)
- [Configuration](#configuration)
- [Running the tests](#running-the-tests)
- [Everyday commands](#everyday-commands)
- [Optional AI features](#optional-ai-features)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Documentation map](#documentation-map)

## What's inside

| Area | Highlights |
| --- | --- |
| Curriculum | Backend track, 22 topics, 22 lessons, **168 questions** (90 flashcards, 45 objective quiz questions, 33 scenarios). Four further tracks are listed as "coming soon". |
| Flashcards | Flip, rate Again / Hard / Good / Easy (buttons show the real next interval), bookmarks, filters, "questions I got wrong", resumable sessions, private custom cards. |
| Quizzes | Multiple choice, select-all, short answer, code reading, scenarios. Practice or test feedback, optional timer, server-side grading, retry missed questions. |
| Adaptive engine | Seeded randomisation, recency avoidance, mistake prioritisation, spaced repetition, topic-weakness detection, topic diversity caps — all per user. |
| Interviews | Written answers, model answer revealed after you commit, rubric self-assessment, keyword hints, optional AI feedback (clearly labelled). |
| Analytics | Accuracy, streak (in your time zone), study time, topic strengths and weaknesses, 30-day activity, 14-day review forecast, next-topic recommendation. Empty states for new users — nothing is invented. |
| Admin | Question editor, validated JSON import with dry run, AI draft review queue, curriculum and lesson editing. |

## Quick start on Windows (VS Code)

### 1. Install the prerequisites

- **Node.js 22 LTS** (20.18+ also works): <https://nodejs.org>. Check with `node -v`.
- **Git**: <https://git-scm.com/download/win>
- **Docker Desktop** (easiest way to run PostgreSQL): <https://www.docker.com/products/docker-desktop/>
  Prefer a native install? See [Without Docker](#without-docker-native-postgresql-on-windows).
- **VS Code** with the recommended extensions: ESLint, Prettier, Prisma, Tailwind CSS IntelliSense.

### 2. Open the project and install dependencies

Unzip (or clone) the project, open the folder in VS Code, then open a terminal (**Terminal → New Terminal**, PowerShell):

```powershell
cd backend-academy
npm install
```

`npm install` also runs `prisma generate`. Commit the generated `package-lock.json` — CI uses it.

### 3. Create your environment file

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Open `.env` and paste the printed value into `AUTH_SECRET`. Change `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (10+ characters) to the account you want as administrator. The database URLs already match the Docker setup.

### 4. Start PostgreSQL

Make sure Docker Desktop is running, then:

```powershell
npm run db:up
```

This starts PostgreSQL 16 on `localhost:5432` and, on first start, creates three databases: `backend_academy` (app), `backend_academy_test` (tests) and `backend_academy_shadow` (migration checks).

### 5. Create the schema and load the questions

```powershell
npm run db:deploy
npm run db:seed
```

`db:deploy` applies the committed migrations. `db:seed` loads the curriculum and question bank and creates your admin account. Both are safe to run again.

### 6. Start the app

```powershell
npm run dev
```

Open <http://localhost:3000>, sign in with your admin email and password (or register a normal account), and start with a **New questions** quiz.

### Without Docker: native PostgreSQL on Windows

1. Install PostgreSQL 16 from <https://www.postgresql.org/download/windows/> (remember the `postgres` password; keep port 5432).
2. In a terminal (use **SQL Shell (psql)** from the Start menu if `psql` is not on your PATH):
   ```sql
   CREATE DATABASE backend_academy;
   CREATE DATABASE backend_academy_test;
   CREATE DATABASE backend_academy_shadow;
   ```
3. Update the password in `DATABASE_URL` and `DATABASE_URL_TEST` in `.env`, then continue from step 5.

## Quick start on macOS / Linux

```bash
npm install
cp .env.example .env    # then set AUTH_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
npm run db:up
npm run db:deploy
npm run db:seed
npm run dev
```

## Configuration

All variables are documented in [`.env.example`](.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string for the app. |
| `DATABASE_URL_TEST` | for tests | Separate database for integration tests. **Its data is deleted** by the tests. |
| `AUTH_SECRET` | yes | Signs session tokens. 32+ random bytes. |
| `AUTH_TRUST_HOST` | production | `true` behind Vercel or a trusted proxy. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | for seeding | Admin account created by `db:seed` if it does not exist. |
| `AI_API_KEY` | no | Enables AI features. Leave empty to run without AI. Never exposed to the browser. |
| `AI_BASE_URL`, `AI_MODEL` | no | Any OpenAI-compatible Chat Completions endpoint. |
| `AI_AUTO_PUBLISH` | no | `true` publishes AI drafts that pass every automated check; default `false` requires admin approval. |
| `AI_GENERATION_HOURLY_LIMIT` | no | Generation requests per user per hour (default 20). |

## Running the tests

| Command | Needs | What it runs |
| --- | --- | --- |
| `npm run test:core` | Node only (works before `npm install` with a global `tsx`) | 126 unit tests of the adaptive engine, scheduling, grading, validation, dedupe, AI pipeline and question bank. |
| `npm run content:check` | Node | Validates every seed question, answer key and rubric, and checks for near-duplicates. |
| `npm run typecheck` | `npm install` | TypeScript across the whole project. |
| `npm run lint` | `npm install` | ESLint (Next.js rules). |
| `npm test` | `npm install`; DB for integration | Vitest: all unit tests plus integration tests against `DATABASE_URL_TEST` (skipped if unset). |
| `npm run test:db` | Docker DB | SQL tests proving the database constraints (27 checks). Set `PSQL=local` to use a local `psql`. |
| `npm run test:e2e` | built app + seeded DB | Playwright: sign-in redirects, flashcards with resume, all three quiz modes, interview without AI, admin protection — on desktop and mobile viewports. |

First-time setup for the database and browser tests:

```powershell
npm run db:test:migrate          # apply migrations to the test database
npm run test:db                  # constraint tests
npm test                         # unit + integration
npx playwright install chromium  # one time
npm run build
npm run test:e2e
```

## Everyday commands

| Command | Description |
| --- | --- |
| `npm run dev` | Development server on port 3000. |
| `npm run build` / `npm start` | Production build / serve it. |
| `npm run db:migrate` | After editing `prisma/schema.prisma`: create and apply a new migration (development only). |
| `npm run db:studio` | Browse the database in Prisma Studio. |
| `npm run db:reset` | Drop and recreate the dev database, then re-seed. **Deletes all data.** |
| `npm run format` | Prettier. |

## Optional AI features

Set `AI_API_KEY` (plus `AI_BASE_URL` / `AI_MODEL` for non-OpenAI providers) and restart. You then get:

- **"Generate an AI variation"** on quiz results — a new question that tests the same concept with a different situation.
- **"Generate a new AI scenario"** on Interview practice.
- **"Get AI feedback"** on interview answers — scores for correctness, completeness, reasoning and clarity, missing concepts, and an improved answer. Always labelled as AI-generated.

Every generated question passes structural validation, an answer-key consistency check, a ban on position-dependent options ("all of the above" breaks when answers are shuffled), and near-duplicate detection against the bank before it is queued. It reaches learners only after admin approval (**Admin → AI drafts**) or, with `AI_AUTO_PUBLISH=true`, automatically — approval re-checks everything against the bank as it is at that moment. Automated checks cannot verify technical accuracy, so review drafts before approving.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel + managed PostgreSQL and for the Docker image.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Can't reach database server at localhost:5432` | Start Docker Desktop and run `npm run db:up`. Check nothing else uses port 5432. |
| `The table "public.Question" does not exist` | Run `npm run db:deploy`. |
| Sign-in fails right after setup | Run `npm run db:seed` and use `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, or register a new account. |
| `MissingSecret` / auth errors | Set `AUTH_SECRET` in `.env` and restart `npm run dev`. |
| `prisma migrate dev` reports drift | The committed SQL is the source of truth. In development only, `npm run db:reset` rebuilds the database. Report it — CI runs a drift check. |
| Integration tests are skipped | Set `DATABASE_URL_TEST` in `.env` and run `npm run db:test:migrate`. |
| PowerShell blocks `npm` scripts | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |

## Documentation map

- [TESTING.md](TESTING.md) — what has been verified and what has not.
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, the adaptive engine, scheduling, AI pipeline, security decisions.
- [DATABASE.md](DATABASE.md) — schema, relationships, constraints.
- [API.md](API.md) — endpoint reference.
- [DEPLOYMENT.md](DEPLOYMENT.md) — production setup.
- [ROADMAP.md](ROADMAP.md) — checklist and future work.
- [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md) — current state for the next developer or coding assistant.
