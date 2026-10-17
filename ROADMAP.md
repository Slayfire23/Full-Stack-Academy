# Roadmap and checklist

Legend: ✅ implemented and verified by execution · 🟡 implemented, not yet executed (see TESTING.md) · ⬜ not started

## Adaptive question system (this iteration)

- ✅ Randomised question selection per quiz (seeded PRNG, reproducible)
- ✅ Randomised answer order per quiz, stored per slot; grading by option id
- ✅ Recently answered questions avoided while alternatives exist (configurable window)
- ✅ Previously incorrect questions prioritised
- ✅ Spaced repetition schedules review questions (shared by flashcards and quizzes)
- ✅ Per-user question history (`QuestionProgress`, `QuestionAttempt`, `ReviewLog`)
- ✅ Modes: New questions, Review weak topics, Mixed practice (engine) · 🟡 UI and API
- ✅ AI variations and new interview scenarios: pipeline with fake model · 🟡 live provider, UI
- ✅ Validation before anything enters the permanent bank (+ re-validation at approval)
- ✅ Exact and near-duplicate prevention (DB unique hash + similarity scoring)
- ✅ Everything works without an AI key (AI paths return 503 / are hidden)

## Phases

| Phase | Status |
| --- | --- |
| 1 Foundation: Next.js, TS, Tailwind, Prisma, Docker Compose, lint config | 🟡 config written; migrations ✅ applied to Postgres |
| 2 Auth + curriculum: Auth.js credentials, protected routes, 22 topics, 22 lessons, seed | 🟡 (seed data ✅ verified via SQL) |
| 3 Flashcards: flip, ratings with intervals, SRS, due queue, bookmarks, filters, resume, custom cards | 🟡 (scheduler ✅) |
| 4 Quizzes: 5 question types, practice/test feedback, timer, server grading, results, retry | 🟡 (grading ✅) |
| 5 Interviews: scenarios, model answers, rubric self-assessment, optional AI feedback, history, retry | 🟡 (AI parsing ✅) |
| 6 Analytics: accuracy, streaks, time, topics, forecast, recommendation | 🟡 (calculations ✅) |
| 7 Admin: CRUD, JSON import with dry run, AI review queue, curriculum editing | 🟡 (validation ✅) |
| 8 Production: tests, CI, Dockerfile, deployment docs | 🟡 CI and Dockerfile written · ⬜ deployed |

## Known gaps and next steps

1. Run the first install and the full verification sequence in TESTING.md; fix anything real types or the build surface.
2. Deploy (DEPLOYMENT.md) and run the production smoke test.
3. Redis-backed rate limiting for multi-instance deployments.
4. Per-question "report a problem" button feeding the admin queue.
5. Admin: bulk publish/unpublish, question version history.
6. Email verification and password reset by email (needs an email provider).
7. Visual polish pass in a real browser at mobile, tablet and desktop widths.
8. Upgrade path: Next.js 16 (`middleware.ts` → `proxy.ts`), Prisma 7 (new generator and driver adapters) — deliberate migrations, not drop-in.
9. Content: a second pass by a human reviewer for technical accuracy; more advanced questions (currently 25 of 168).
10. Additional learning tracks (data only — see ARCHITECTURE.md § Multiple tracks).
