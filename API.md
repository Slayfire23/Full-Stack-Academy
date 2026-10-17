# API reference

JSON over HTTP. All endpoints except `/api/health`, `/api/register` and `/api/auth/*` require a signed-in session (cookie set by Auth.js). Request bodies must be `Content-Type: application/json`; schemas are in [`src/lib/validation/schemas.ts`](src/lib/validation/schemas.ts).

## Conventions

**Errors** always look like:

```json
{ "error": { "message": "Some fields are invalid", "code": "invalid", "details": { "email": "Enter a valid email address" } }, "requestId": "6f1c…" }
```

| Status | Meaning |
| --- | --- |
| 400 | Malformed JSON or request |
| 401 | Not signed in / session no longer valid |
| 403 | Signed in but not allowed (admin endpoints) |
| 404 | Not found — **also returned for resources owned by someone else** |
| 409 | Conflict with current state (duplicate, finished quiz, time up) |
| 413 / 415 | Body too large / not JSON |
| 422 | Valid JSON that fails validation or business rules |
| 429 | Rate limited — see `Retry-After` |
| 502 | AI provider failed |
| 503 | Feature unavailable (AI not configured) or database down |

Every response carries `x-request-id`; send your own (8–64 chars `[A-Za-z0-9-]`) to correlate logs.

**Pagination** is cursor-based: `?limit=20&cursor=<id>`; responses contain `{ items, nextCursor }` (`null` when there are no more).

## Health and auth

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | `{ status, database }`; 503 when the database is unreachable. |
| POST | `/api/register` | `{ name, email, password }` → 201 `{ user }`. 409 if the email exists. Rate limited per IP. |
| GET/POST | `/api/auth/*` | Auth.js: `signin/credentials`, `signout`, `session`, `csrf`. The UI uses server actions for sign in/out. |
| GET | `/api/me` | Current profile + settings (session retrieval). |
| PATCH | `/api/me` | `{ name?, currentPassword?, newPassword? }` |
| DELETE | `/api/me` | `{ password }` — deletes the account and all private data. |
| GET / PATCH | `/api/settings` | `{ theme, dailyGoal, preferredDifficulty, defaultSelectionMode, recentWindowHours, timeZone }` |

## Curriculum

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/tracks` | All tracks, with `comingSoon`. |
| GET | `/api/tracks/:slug` | Topics with question counts and the user's seen/mastered counts. |
| GET | `/api/topics?track=backend` | Topics of a track. |
| GET | `/api/topics/:id` | Topic with lessons and question-type counts. |
| GET | `/api/topics/:id/lessons` | Lessons only. |
| GET | `/api/questions?topicId&difficulty&type&q&cursor&limit` | Browse questions. **Never includes answer keys.** |

## Learn Mode

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/learn/lessons/:id` | Lesson with structured fields (falls back to `content` when empty), prerequisite lock state, this user's progress, and its linked practice questions (keys hidden until answered). 404 if unpublished or not found. |
| POST | `/api/learn/lessons/:id/view` | Marks the lesson viewed: `NOT_STARTED` → `IN_PROGRESS`, bumps `lastViewedAt`. Returns the updated progress. |
| POST | `/api/learn/lessons/:id/complete` | `{ understanding?: 1-5 }` → marks `COMPLETED`; 422 if the lesson was never viewed. Resolves every unresolved "haven't learned this yet" mark linked to the lesson for this user; returns `{ progress, resolvedMarks }`. |
| POST | `/api/learn/lessons/:id/practice` | `{ questionId, answer: { optionIds } \| { text }, responseTimeMs? }` — grades server-side like a quiz answer, updates the lesson's own `practiceAttempts`/`practiceCorrect`, and feeds the same per-question spaced-repetition schedule as quizzes (kind `LESSON_PRACTICE`). 404 if the question isn't linked to this lesson or isn't visible to the user. |
| POST | `/api/learn/unfamiliar` | `{ questionId, source: FLASHCARD\|QUIZ\|INTERVIEW, quizAttemptId? }` — "I haven't learned this yet": records an ungraded outcome (never counted incorrect, no SRS lapse) and upserts an unfamiliar mark (reactivating it if it was previously resolved). Pass `quizAttemptId` when marking a quiz question — it's then excluded from that quiz's score denominator instead of counting as unanswered. Re-marking a question already answered in that quiz is a no-op (`duplicate: true`, nothing changes). |
| GET | `/api/learn/recommendations` | Up to 5 not-yet-completed lessons ranked by unresolved unfamiliar marks, recently missed questions, low topic accuracy and unmet prerequisites, each with a plain-language `reason`. New users (no answers yet) get a single starting-point lesson instead. |

## Flashcards

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/flashcards/due?topicIds=a,b&difficulty&limit&newLimit&bookmarkedOnly&includeNew&incorrectOnly` | Due cards (most overdue first) interleaved with capped new cards, plus `{ due, dueWithin24h }`. |
| GET | `/api/flashcards/session` | The unfinished session to resume, or `null`. |
| POST | `/api/flashcards/session` | `{ topicIds, difficulty?, bookmarkedOnly, incorrectOnly, includeNew, limit, newLimit }` → 201 new session, or 200 with `resumed: true`. |
| PATCH | `/api/flashcards/session/:id` | `{ index?, end? }` |
| POST | `/api/flashcards/reviews` | `{ questionId, rating: AGAIN\|HARD\|GOOD\|EASY, idempotencyKey?, sessionId?, responseTimeMs? }` → new schedule. Replaying a key returns `duplicate: true` and changes nothing. |
| GET | `/api/flashcards/reviews` | Review history (paginated). |
| GET / POST | `/api/flashcards/custom` | List / create private cards `{ topicId, difficulty, prompt, answer, explanation?, codeExample?, tags }`. Response includes `similarTo` when it resembles a bank question. |
| PATCH / DELETE | `/api/flashcards/custom/:id` | Owner only (404 otherwise). |
| GET / POST | `/api/bookmarks` | List / add `{ questionId }` (idempotent). |
| DELETE | `/api/bookmarks/:questionId` | Remove. |

## Quizzes

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/quizzes` | `{ mode: NEW\|WEAK\|MIXED, topicIds, difficulty?, count (1–50), types?, feedbackMode: IMMEDIATE\|END, timeLimitSeconds? }` → 201 `{ quizId, diagnostics }`. Diagnostics: pool sizes, whether recently-seen questions had to be used, weak topics, picks per reason, shortfall. |
| GET | `/api/quizzes` | History (paginated). |
| GET | `/api/quizzes/:id` | Questions in this quiz's option order. Keys only for answered questions in IMMEDIATE mode, or after completion. Timed quizzes past their deadline are completed automatically. |
| POST | `/api/quizzes/:id/answers` | `{ questionId, answer: { optionIds } \| { text }, responseTimeMs? }` → 201 with the verdict (IMMEDIATE) or `{ recorded: true }` (END). A repeat returns 200 `duplicate: true` with the original verdict. 409 when finished or out of time. |
| POST | `/api/quizzes/:id/finish` | Idempotent. Score = correct ÷ objective questions × 100 (unanswered count as wrong; scenarios never affect it). |
| GET | `/api/quizzes/:id/results` | Full review with keys, explanations and per-topic breakdown. 409 until finished. |
| POST | `/api/quizzes/:id/retry` | `{ scope: "incorrect" \| "all" }` → 201 new quiz, freshly shuffled. |

## Interviews

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/interviews` | `{ topicId?, difficulty, mode, count (1–5), questionIds? }` — `questionIds` retries specific scenarios. |
| GET | `/api/interviews` | Previous sessions. |
| GET | `/api/interviews/:id` | Session; model answers and rubric only for answered questions. |
| POST | `/api/interviews/:id/responses` | `{ questionId, response, selfAssessment?: { conceptKey: boolean } }` — save or revise; returns the session with reveals. Revising clears stale AI feedback. |
| POST | `/api/interviews/:id/responses/:questionId/feedback` | AI evaluation. 503 without `AI_API_KEY`; rate limited. |
| POST | `/api/interviews/:id/complete` | Mark complete. |

## Analytics

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/analytics/dashboard` | Everything on the dashboard: totals, accuracy (`null` before any graded answer), streak, study minutes, coverage, topic stats, weakest/strongest, recent quizzes, 30-day series, 14-day due forecast, recommendation (`basis: "history" \| "starting-point"`). |
| GET | `/api/analytics/topics` | Topic performance. |
| GET | `/api/analytics/history?days=30` | Daily answered/correct series (7–365 days). |

## AI generation

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/generation` | `{ aiConfigured, autoPublish, hourlyLimit }` — never exposes keys. |
| POST | `/api/generation` | `{ kind: "VARIATION", questionId }` or `{ kind: "INTERVIEW_SCENARIO", topicId, difficulty }` → 201 `{ id, status: PENDING_REVIEW\|APPROVED\|REJECTED, draft, validation, rejectionReason }`. 429 over the hourly quota, 503 without AI. |

## Admin (role ADMIN, checked against the database on every call)

| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/api/admin/tracks` | List / create. |
| PATCH / DELETE | `/api/admin/tracks/:id` | Only the fields you send change. Delete refuses non-empty tracks. |
| GET / POST | `/api/admin/topics?trackId` | |
| PATCH / DELETE | `/api/admin/topics/:id` | Delete refuses topics with questions. |
| GET / POST | `/api/admin/lessons?topicId` | Lessons include every structured field (`summary`, `explanation`, `realWorldExample`, `codeExample`/`codeLanguage`, `commonMistakes`, `level`, `estimatedMinutes`, `published`), their prerequisites and their linked practice questions. |
| PATCH / DELETE | `/api/admin/lessons/:id` | Same structured fields, all optional on PATCH. |
| POST | `/api/admin/lessons/:id/prerequisites` | `{ prerequisiteId }` → 201. 422 if it would make a lesson require itself, directly or through a chain; 409 if already set. |
| DELETE | `/api/admin/lessons/:id/prerequisites/:prerequisiteId` | Remove a prerequisite (no-op if absent). |
| POST | `/api/admin/lessons/:id/questions` | `{ questionId }` → 204. Links a bank question (`ownerId: null`) to the lesson as a practice question. |
| DELETE | `/api/admin/lessons/:id/questions/:questionId` | Unlink (sets the question's `lessonId` to `null`; the question itself is untouched). |
| GET / POST | `/api/admin/questions?topicId&q&cursor&limit` | Includes answer keys. Create validates and rejects near-duplicates (409). |
| GET / PATCH / DELETE | `/api/admin/questions/:id` | PATCH takes the full question. DELETE unpublishes answered questions unless `?force=true`. |
| POST | `/api/admin/import` | `{ trackSlug, dryRun, onExisting: skip\|update, questions: [...] }` (≤ 500, ≤ 5 MB) → per-row report: created / updated / skipped / invalid / duplicate. Valid rows are written in one transaction. |
| GET | `/api/admin/generated?status&cursor&limit` | AI draft queue. |
| POST | `/api/admin/generated/:id` | `{ action: "approve" }` or `{ action: "reject", reason }`. Approve re-validates and re-checks duplicates. |

### Import format

```json
{
  "questions": [
    {
      "externalKey": "http-900",
      "topicSlug": "http",
      "type": "MULTIPLE_CHOICE",
      "difficulty": "BEGINNER",
      "prompt": "Which status code fits a successful POST that creates a resource?",
      "answer": "201 Created",
      "explanation": "201 signals creation; add a Location header pointing at the new resource.",
      "answerData": {
        "kind": "MULTIPLE_CHOICE",
        "options": [{ "id": "a", "text": "200 OK" }, { "id": "b", "text": "201 Created" }, { "id": "c", "text": "204 No Content" }],
        "correctOptionIds": ["b"]
      },
      "tags": ["http"]
    }
  ]
}
```

`answerData` shapes: `FLASHCARD {kind}`, `MULTIPLE_CHOICE` / `CODE_READING` (+ top-level `codeExample`) `{options, correctOptionIds: [one]}`, `MULTIPLE_SELECT {options, correctOptionIds: [2+]}`, `SHORT_ANSWER {acceptedAnswers}`, `SCENARIO {modelAnswer (120+ chars), keyConcepts: [{key, label, keywords}] (3–8)}`.
