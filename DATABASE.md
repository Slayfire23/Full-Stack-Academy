# Database

PostgreSQL 16 via Prisma 6. Schema: [`prisma/schema.prisma`](prisma/schema.prisma). Migrations: [`prisma/migrations`](prisma/migrations) — the committed SQL is the source of truth (`npm run db:deploy` applies it). Constraint tests: [`tests/db/constraints.sql`](tests/db/constraints.sql) (`npm run test:db`).

## Entity overview

```
User ─┬─ UserSettings (1:1)
      ├─ QuestionProgress (per question: schedule + history)
      ├─ ReviewLog (every scheduling change)
      ├─ QuestionAttempt (every submitted answer)
      ├─ QuizAttempt ── QuizAttemptQuestion (ordered slots, shuffled option order)
      ├─ InterviewSession ── InterviewResponse
      ├─ StudySession (resumable flashcard sessions, study time)
      ├─ Bookmark
      ├─ Question (owner: private custom cards)
      └─ GeneratedQuestion (requested / reviewed)

LearningTrack ── Topic ── Lesson
                   └──── Question ── (variations: parentQuestionId) ── GeneratedQuestion
```

## Tables

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `User` | Accounts. `passwordHash` is bcrypt; never selected into API responses. | `email` unique |
| `UserSettings` | Theme, daily goal, preferred difficulty, default quiz mode, recency window (hours), time zone. | PK = `userId`; CHECK goal 1–500, window 0–720 |
| `LearningTrack` | Curriculum tracks. `published = false` shows as "coming soon". | `slug` unique |
| `Topic` | Topics within a track, ordered. | unique (`trackId`, `slug`) |
| `Lesson` | Markdown lessons within a topic. | unique (`topicId`, `slug`) |
| `Question` | All study material. `type` + `answerData` (JSON, validated in code) define grading. `answer` is the canonical answer text. | `externalKey` unique; unique (`dedupeScope`, `contentHash`); CHECK owner ⇔ scope |
| `QuestionProgress` | Per-user schedule (repetitions, interval, ease, lapses, next review) and history (seen/correct/incorrect, streak, last result, last seen). Replaces the roadmap's `FlashcardProgress` so quizzes and flashcards share one schedule. | unique (`userId`, `questionId`); CHECK ease ≥ 1.3, interval ≥ 0, counters ≥ 0, seen ≥ graded |
| `ReviewLog` | Immutable record of rating, kind, old/new interval and ease. | unique (`userId`, `idempotencyKey`) |
| `QuizAttempt` | One quiz: mode, feedback mode, time limit, seed, filters, counts, score. | CHECK score 0–100, correct ≤ graded ≤ count, count 1–100 |
| `QuizAttemptQuestion` | Ordered slots with per-quiz `optionOrder` and `selectionReason`. | unique (`quizAttemptId`, `position`) and (`quizAttemptId`, `questionId`) |
| `QuestionAttempt` | Every answer. `correct` is null when not objectively graded. | unique (`quizAttemptId`, `questionId`) — duplicate-submission guard |
| `InterviewSession` | Topic, difficulty, ordered `questionIds`. | — |
| `InterviewResponse` | Written answer, rubric result (keyword coverage + self-assessment), AI feedback (separate column), score. | unique (`sessionId`, `questionId`); CHECK score 0–100 |
| `StudySession` | Resumable flashcard queue state (JSON) and activity timestamps. | — |
| `Bookmark` | User ↔ question. | PK (`userId`, `questionId`) |
| `GeneratedQuestion` | AI drafts with validation report, similarity, review status and link to the published question. Never served to learners. | `publishedQuestionId` unique |

## Relationship and deletion rules

| Relation | On delete |
| --- | --- |
| User → all private data (settings, progress, logs, attempts, quizzes, interviews, sessions, bookmarks, custom cards) | CASCADE — deleting an account removes everything private |
| User → GeneratedQuestion (requester / reviewer) | SET NULL — review history survives |
| Track → Topic → Lesson / Question | CASCADE (admin API refuses to delete non-empty tracks and topics) |
| Lesson → Question | SET NULL |
| Question → progress, attempts, slots, bookmarks, responses | CASCADE — admin deletes of answered questions are converted to unpublish |
| Question → variations (`parentQuestionId`), GeneratedQuestion links | SET NULL |
| QuizAttempt → slots, attempts | CASCADE |

## Indexes and why

| Index | Serves |
| --- | --- |
| `Question (topicId, published, difficulty)` | building candidate pools |
| `Question (type, published)` | type-filtered pools (scenarios, objective) |
| `QuestionProgress (userId, nextReviewAt)` | due counts and the review queue |
| `QuestionProgress (userId, lastSeenAt)` | recency checks |
| `QuestionAttempt (userId, createdAt)`, `(userId, questionId, createdAt)` | analytics, streaks, history |
| `QuizAttempt (userId, startedAt)`, `(userId, status)` | quiz history |
| `ReviewLog (userId, reviewedAt)` | review history |
| `GeneratedQuestion (status, createdAt)`, `(requestedById, createdAt)`, `(contentHash)` | review queue, hourly quota, dedupe |

## Hand-written SQL

- `20261016000100_check_constraints` adds the CHECK constraints above. Prisma cannot express them and does not report them as drift.
- `progress.service.ts` uses two raw statements (parameterised via tagged templates): the `INSERT … ON CONFLICT DO NOTHING` upsert and the `SELECT … FOR UPDATE` lock. `finishQuiz` and `approveGenerated` also lock their row with `FOR UPDATE`.

## Changing the schema

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate -- --name describe_change` (development only) generates and applies a new migration.
3. Commit the new folder under `prisma/migrations`.
4. Production runs `npm run db:deploy`. Prefer backward-compatible changes (expand → migrate → contract) so a rolling deploy never runs new code against an old schema or vice versa.
