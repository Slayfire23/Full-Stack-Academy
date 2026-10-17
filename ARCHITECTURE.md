# Architecture

## Overview

```
Browser ──► Next.js App Router (React Server Components + client components)
              │
              ├─ pages (src/app/(app)/**)      server components call services directly
              ├─ server actions (sign in/up)   src/app/(auth)/actions.ts
              └─ REST API (src/app/api/**)     route() wrapper → requireUser/requireAdmin → Zod → service
                                                   │
                                   src/server/services/*   (business logic, Prisma, transactions)
                                                   │
                     src/lib/adaptive/* , src/lib/ai/*   (pure, dependency-free decision logic)
                                                   │
                                            PostgreSQL via Prisma
```

The most important design rule: **every decision lives in pure functions** under `src/lib/adaptive` and `src/lib/ai`. They take data in and return decisions, with no database, network or clock access (time and randomness are parameters). Services load data, call the pure functions and persist the result. This is what made it possible to verify the whole adaptive system without a running app — and it keeps the logic testable forever.

| Layer | Folder | Responsibility |
| --- | --- | --- |
| UI | `src/app`, `src/components` | Rendering, forms, keyboard handling. Never grades, never sees answer keys before submission. |
| HTTP | `src/server/http.ts`, `src/app/api` | Auth, validation, status codes, consistent error JSON, request ids. |
| Services | `src/server/services` | Orchestration, ownership checks, transactions, row locks. |
| Engine | `src/lib/adaptive` | Selection, scheduling, grading, validation, dedupe, analytics maths. |
| AI | `src/lib/ai` | OpenAI-compatible client, prompts, output parsing and validation. |
| Content | `content/` | Curriculum and seed questions as typed data. |

## The adaptive question system

### Per-user history

`QuestionProgress` has one row per (user, question) holding both the spaced-repetition state (repetitions, interval, ease, next review) and answer history (times seen/correct/incorrect, streak, last result, last seen). Every answer — flashcard rating, quiz answer or interview response — goes through one function, `recordOutcome` (`progress.service.ts`), so all study modes feed the same schedule. `ReviewLog` keeps an immutable log of each scheduling change and `QuestionAttempt` keeps every submitted answer.

Concurrency: `recordOutcome` creates the row with `INSERT … ON CONFLICT DO NOTHING`, then locks it with `SELECT … FOR UPDATE` before computing the new state, so two simultaneous answers to the same question are applied one after the other rather than overwriting each other. A CHECK constraint (`timesSeen >= timesCorrect + timesIncorrect`, ease ≥ 1.3, non-negative interval) backs this up in the database.

### Selection pipeline (`src/lib/adaptive/selection.ts`)

`selectQuestions(candidates, history, options)` is pure and deterministic for a given seed.

1. **Classify** each candidate for this user: unseen, due (next review ≤ now), struggling (last answer wrong, or > 40% wrong with fewer than 2 recent correct), recent (seen inside the recency window), weak topic, mastered (3+ correct in a row and not due).
2. **Weak topics** come from Laplace-smoothed accuracy `(correct + 1) / (attempts + 2)` across *all* of the user's answers, needing at least 3 answers. Topics below 70% are weak; if none are, the bottom third still count, so Review Weak Topics always has a target once there is history.
3. **Recency avoidance**: anything answered inside `recentWindowHours` (default 24, user-configurable, 0 disables) goes into a fallback tier, used only if the fresh pool cannot fill the quiz. Fallback picks prefer the longest-ago and missed questions and are labelled `fallback`.
4. **Priority tiers per mode**, each filled by weighted random sampling:

   | Mode | Tier order |
   | --- | --- |
   | New questions | unseen → everything else by staleness |
   | Review weak topics | missed or due → weak-topic questions → everything else |
   | Mixed practice | quotas: 40% missed/due, 20% weak topic, 40% unseen → remainder by weight |

5. **Weighted sampling without replacement** (Efraimidis–Spirakis): a higher weight makes a question more likely, never certain. The *kind* of question is guaranteed by the tiers; the *specific* questions vary, so two sessions with identical history still differ.
6. **Topic diversity**: when several topics are in play, no topic may take more than ~40% of the quiz (min 2); the cap relaxes rather than returning a short quiz.
7. **Shuffle** the final list so priority items are not front-loaded, and record a `selectionReason` per slot. The quiz page shows a one-line summary ("4 new to you, 3 due for review, 2 missed before…").

### Randomisation and answer order

Each quiz stores a 31-bit `seed`. All randomness for that quiz comes from a mulberry32 PRNG seeded with it, so any quiz can be reproduced exactly when debugging. Option order is shuffled per quiz from a separate stream and stored in `QuizAttemptQuestion.optionOrder`; for 3+ options the authored order is re-rolled, so the right answer is not always where the author put it. **Grading is by option id, never by position**, so shuffling can never change a verdict. The validator rejects options such as "All of the above" that would break under shuffling.

### Spaced repetition (`src/lib/adaptive/srs.ts`)

A deterministic SM-2 variant with four ratings (no random "fuzz", so it is explainable and testable):

| Rating | Effect |
| --- | --- |
| Again | relearn in 10 minutes, repetitions reset, ease −0.20, lapse +1 |
| Hard | interval × 1.2 (min 1 day), ease −0.15 |
| Good | 1 day, then 6 days, then interval × ease |
| Easy | 4 days, then interval × ease × 1.3, ease +0.15 |

Ease is clamped to [1.3, 3.0], intervals are whole days capped at 365, and every successful review moves the card forward by at least a day. Objective quiz answers map to Good (correct) or Again (incorrect). Flashcard Again counts as "not recalled"; Hard/Good/Easy count as recalled. Open-ended answers mark the question as seen (for recency avoidance) but never move the schedule, because nothing objectively graded them. The flashcard UI imports the same function to show "Good — in 6 days" on each button.

### Duplicate and near-duplicate prevention (`similarity.ts`)

- **Exact**: `contentHash` = SHA-256 of the normalised prompt + answer. A unique index on `(dedupeScope, contentHash)` makes exact duplicates impossible in the shared bank (`dedupeScope = "global"`) and within each user's private cards (`dedupeScope = userId`), while letting a user keep a private copy of a bank question.
- **Near**: similarity = 0.75 × prompt similarity + 0.25 × answer similarity, where each is the max of character-trigram Jaccard (robust to typos and punctuation) and content-word Jaccard (stop words removed, light stemming — robust to reordering). ≥ 0.82 is a duplicate and rejected; 0.60–0.82 is allowed but flagged for review. The seed bank has zero pairs above 0.60.

The same checks guard AI drafts, admin edits, JSON imports and custom cards.

### AI generation (`src/lib/ai/generation.ts`, `generation.service.ts`)

```
request ─► quota check (DB count, exact across instances)
        ─► prompt (source question / topic, avoid-list; reference text fenced as data)
        ─► model (JSON mode) ─► extract JSON ─► normalise
        ─► validateQuestionDraft  (structure, key consistency, shuffle-safe options, no placeholder/refusal text)
        ─► type/difficulty match
        ─► duplicate check vs topic bank + the source + pending drafts
        ─► GeneratedQuestion: PENDING_REVIEW or REJECTED (with reasons)
        ─► approve (admin, or AI_AUTO_PUBLISH) ─► re-validate + re-dedupe vs current bank ─► Question(source=AI_GENERATED, parentQuestionId)
```

Model output is treated as untrusted input: parsed, never evaluated, re-validated field by field, length-capped, and rendered as text (React escapes it). Provider error bodies are never passed to users. Nothing in `GeneratedQuestion` is served to learners. AI interview feedback scores are clamped and the overall score is computed locally, never taken from the model; the learner's answer is fenced and the model is told to ignore instructions inside it. All AI output is labelled as AI-generated.

Without `AI_API_KEY`, generation endpoints return 503 with an explanation, AI buttons are hidden, and every other feature works.

## Security decisions

- **Authentication**: Auth.js v5 credentials provider, bcrypt (cost 12), JWT sessions in HttpOnly cookies. Unknown emails are compared against a dummy hash so timing does not reveal which emails exist. Login is rate limited per email+IP; registration per IP.
- **Authorization**: `requireUser()` re-reads the user from the database on every API call, so deleted accounts and role changes take effect immediately despite stateless JWTs. Admin routes call `requireAdmin()`; admin pages 404 for non-admins.
- **Ownership**: every query for private data includes `userId` in its WHERE clause, so another user's id is indistinguishable from a missing one (404, no existence leak). User-supplied ids are only ever lookup keys, never proof of access.
- **Answer keys**: quiz views only include keys for questions already answered with immediate feedback, or after completion. Question browsing never includes keys.
- **Validation**: every body, query and path parameter is parsed with Zod; unknown keys are stripped (no mass assignment). Malformed JSON → 400, invalid content → 422, wrong content type → 415, oversized body → 413.
- **Idempotency**: quiz answers are unique per (quiz, question) — replays return the original verdict; flashcard reviews accept an idempotency key unique per user; finishing a quiz takes a row lock and is idempotent.
- **Headers**: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; no `X-Powered-By`.
- **Secrets**: only read on the server; `.env` is git-ignored; the AI key is sent only as a bearer header to the configured provider.

### Rate limiting

In-memory sliding windows (`src/lib/rate-limit.ts`) protect login, registration, AI feedback and mutation-heavy endpoints. They are per process: exact on a single server or container, best-effort on serverless platforms where instances come and go. The AI generation quota — the expensive one — is enforced from the database and is exact everywhere. For multi-instance production, swap the limiter's storage for Redis (the interface is one `check(key)` method).

## Error handling and observability

Every route is wrapped in `route()`, which returns `{ error: { message, code, details? }, requestId }` with the right status, maps Prisma P2002 → 409 and P2025 → 404, and logs unexpected errors as structured JSON (secrets redacted by key name) with the request id that the client also receives. `/api/health` checks database connectivity for uptime checks and the Docker HEALTHCHECK.

## Frontend

Server components fetch through services directly (no internal HTTP hop); client components call the REST API through `src/lib/api-client.ts`. Tailwind CSS v4 with design tokens in `globals.css` (dark default, light theme via `next-themes`). Components follow shadcn/ui conventions (`cn()`, variant props) but are hand-written, so there is no generated `components.json`; `npx shadcn add` can be introduced later. Accessibility: skip link, visible focus rings, labelled controls, `aria-current` navigation, keyboard flashcards (Space, 1–4, arrows), reduced-motion support for the one animation (card flip).

## Multiple tracks

Tracks → topics → lessons → questions are all data. A new track is created in Admin → Curriculum (unpublished = "coming soon"), topics and lessons are added there, and questions are imported with `topicSlug` + `trackSlug`. No code changes are needed.
