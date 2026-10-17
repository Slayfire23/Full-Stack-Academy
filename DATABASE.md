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
      ├─ GeneratedQuestion (requested / reviewed)
      ├─ LessonProgress (per lesson: status, understanding, practice counters)
      └─ UnfamiliarMark ("haven't learned this yet", per question)

LearningTrack ── Topic ── Lesson ── LessonPrerequisite (self-referencing: lessonId → prerequisiteId)
                   └──── Question ── (variations: parentQuestionId) ── GeneratedQuestion
```

## Tables

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `User` | Accounts. `passwordHash` is bcrypt; never selected into API responses. | `email` unique |
| `UserSettings` | Theme, daily goal, preferred difficulty, default quiz mode, recency window (hours), time zone. | PK = `userId`; CHECK goal 1–500, window 0–720 |
| `LearningTrack` | Curriculum tracks. `published = false` shows as "coming soon". | `slug` unique |
| `Topic` | Topics within a track, ordered. | unique (`trackId`, `slug`) |
| `Lesson` | Lessons within a topic. `content` is the legacy Markdown body; `summary`, `explanation`, `realWorldExample`, `codeExample`/`codeLanguage` and `commonMistakes` are the structured Learn Mode fields the UI prefers when non-empty. `level`, `estimatedMinutes`, `published`. | unique (`topicId`, `slug`) |
| `LessonPrerequisite` | Directed edge: `lessonId` should not be started before `prerequisiteId` is completed. Self-referencing on `Lesson`. | PK (`lessonId`, `prerequisiteId`); CHECK `lessonId <> prerequisiteId` |
| `LessonProgress` | Per-user lesson state: `status` (`NOT_STARTED`/`IN_PROGRESS`/`COMPLETED`), self-rated `understanding` (1–5), `practiceAttempts`/`practiceCorrect`. Tracked separately from quiz/flashcard accuracy. | unique (`userId`, `lessonId`); CHECK understanding 1–5 or null, counters ≥ 0, correct ≤ attempts |
| `UnfamiliarMark` | "I haven't learned this yet", one open mark per (user, question). Resolved when the linked lesson is completed; re-marking after resolution reactivates the same row. | unique (`userId`, `questionId`) |
| `Question` | All study material. `type` + `answerData` (JSON, validated in code) define grading. `answer` is the canonical answer text. `lessonId` links it as a practice question for that lesson. | `externalKey` unique; unique (`dedupeScope`, `contentHash`); CHECK owner ⇔ scope |
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
| Lesson → LessonPrerequisite (either side), LessonProgress | CASCADE |
| Lesson → UnfamiliarMark | SET NULL (the mark survives; it just loses its lesson link) |
| Question → progress, attempts, slots, bookmarks, responses, UnfamiliarMark | CASCADE — admin deletes of answered questions are converted to unpublish |
| Question → variations (`parentQuestionId`), GeneratedQuestion links | SET NULL |
| QuizAttempt → slots, attempts | CASCADE |
| User → LessonProgress, UnfamiliarMark | CASCADE (part of "deleting an account removes everything private", above) |

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
| `LessonPrerequisite (prerequisiteId)` | computing which lessons a given lesson unlocks |
| `LessonProgress (userId, status)` | completed-lesson lookups for locking and recommendations |
| `UnfamiliarMark (userId, resolvedAt)`, `(lessonId)` | unresolved-mark counts for recommendations; resolving by lesson |

## Hand-written SQL

- `20261016000100_check_constraints` adds the CHECK constraints above (original tables). Prisma cannot express them and does not report them as drift.
- `20261017191658_learn_mode` adds the Learn Mode tables/columns and their own CHECK constraints the same way, plus one `ALTER TYPE ... ADD VALUE` (`StudyKind.LESSON_PRACTICE` — lesson practice answers feed the same per-question schedule as quizzes, under their own kind).
- `progress.service.ts` uses two raw statements (parameterised via tagged templates): the `INSERT … ON CONFLICT DO NOTHING` upsert and the `SELECT … FOR UPDATE` lock. `finishQuiz` and `approveGenerated` also lock their row with `FOR UPDATE`.

## Changing the schema

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate -- --name describe_change` (development only) generates and applies a new migration.
3. Commit the new folder under `prisma/migrations`.
4. Production runs `npm run db:deploy`. Prefer backward-compatible changes (expand → migrate → contract) so a rolling deploy never runs new code against an old schema or vice versa.
