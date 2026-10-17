-- Database constraint tests. Pure SQL, runs against a migrated database:
--   psql "$DATABASE_URL_TEST" -v ON_ERROR_STOP=1 -f tests/db/constraints.sql
-- Everything runs in one transaction that is rolled back, so the database is left untouched.
-- Any failed assertion raises an exception and psql exits non-zero.

\pset tuples_only on
\pset format unaligned

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(stmt text, expected_state text, label text) RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN others THEN
    IF SQLSTATE <> expected_state THEN
      RAISE EXCEPTION 'FAIL %: expected SQLSTATE % but got % (%)', label, expected_state, SQLSTATE, SQLERRM;
    END IF;
    RAISE NOTICE 'ok   %', label;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL %: statement unexpectedly succeeded', label;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.expect(cond boolean, label text) RETURNS void AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FAIL %', label; END IF;
  RAISE NOTICE 'ok   %', label;
END;
$$ LANGUAGE plpgsql;

-- Fixtures
INSERT INTO "User"(id, name, email, "passwordHash", "updatedAt") VALUES
  ('u1', 'Ada', 'ada@example.com', 'x', now()),
  ('u2', 'Bob', 'bob@example.com', 'x', now());
INSERT INTO "LearningTrack"(id, slug, title, description, "updatedAt") VALUES ('t1', 'backend', 'Backend', 'd', now());
INSERT INTO "Topic"(id, "trackId", slug, title, description, "updatedAt") VALUES ('tp1', 't1', 'http', 'HTTP', 'd', now());
INSERT INTO "Question"(id, "topicId", type, difficulty, prompt, answer, explanation, "answerData", "contentHash", "updatedAt")
  VALUES ('q1', 'tp1', 'FLASHCARD', 'BEGINNER', 'What is 404?', 'Not Found', 'e', '{"kind":"FLASHCARD"}', 'h1', now()),
         ('q2', 'tp1', 'FLASHCARD', 'BEGINNER', 'What is 500?', 'Server error', 'e', '{"kind":"FLASHCARD"}', 'h2', now());
INSERT INTO "Lesson"(id, "topicId", slug, title, content, "updatedAt") VALUES
  ('l1', 'tp1', 'http-basics', 'HTTP Basics', 'c', now()),
  ('l2', 'tp1', 'status-codes', 'Status Codes', 'c', now());

-- 1. Unique email
SELECT pg_temp.expect_error($$INSERT INTO "User"(id, name, email, "passwordHash", "updatedAt") VALUES ('u3','x','ada@example.com','x',now())$$,
  '23505', 'duplicate email rejected');

-- 2. Exact-duplicate question in the global bank rejected
SELECT pg_temp.expect_error($$INSERT INTO "Question"(id, "topicId", type, difficulty, prompt, answer, explanation, "answerData", "contentHash", "updatedAt")
  VALUES ('q3','tp1','FLASHCARD','BEGINNER','What is 404?','Not Found','e','{}','h1',now())$$,
  '23505', 'duplicate contentHash in global scope rejected');

-- 3. Same content allowed as a private custom card (different dedupe scope)...
INSERT INTO "Question"(id, "topicId", type, difficulty, prompt, answer, explanation, "answerData", "contentHash", "dedupeScope", "ownerId", source, published, "updatedAt")
  VALUES ('q4','tp1','FLASHCARD','BEGINNER','What is 404?','Not Found','e','{}','h1','u1','u1','USER_CUSTOM',false,now());
SELECT pg_temp.expect(true, 'same content allowed in a user''s private scope');
-- ...but not twice for the same user
SELECT pg_temp.expect_error($$INSERT INTO "Question"(id, "topicId", type, difficulty, prompt, answer, explanation, "answerData", "contentHash", "dedupeScope", "ownerId", "updatedAt")
  VALUES ('q5','tp1','FLASHCARD','BEGINNER','x','y','e','{}','h1','u1','u1',now())$$,
  '23505', 'duplicate custom card for the same user rejected');

-- 4. Owner/scope consistency
SELECT pg_temp.expect_error($$INSERT INTO "Question"(id, "topicId", type, difficulty, prompt, answer, explanation, "answerData", "contentHash", "dedupeScope", "ownerId", "updatedAt")
  VALUES ('q6','tp1','FLASHCARD','BEGINNER','x','y','e','{}','h9','global','u1',now())$$,
  '23514', 'owned question must be in its owner''s dedupe scope');

-- 5. One progress row per (user, question)
INSERT INTO "QuestionProgress"(id, "userId", "questionId", "updatedAt") VALUES ('p1','u1','q1',now());
SELECT pg_temp.expect_error($$INSERT INTO "QuestionProgress"(id, "userId", "questionId", "updatedAt") VALUES ('p2','u1','q1',now())$$,
  '23505', 'duplicate progress row rejected');
INSERT INTO "QuestionProgress"(id, "userId", "questionId", "updatedAt") VALUES ('p3','u2','q1',now());
SELECT pg_temp.expect(true, 'separate progress rows per user allowed');

-- 6. SRS state sanity
SELECT pg_temp.expect_error($$UPDATE "QuestionProgress" SET "easeFactor" = 1.0 WHERE id = 'p1'$$, '23514', 'ease factor below 1.3 rejected');
SELECT pg_temp.expect_error($$UPDATE "QuestionProgress" SET "intervalDays" = -1 WHERE id = 'p1'$$, '23514', 'negative interval rejected');
SELECT pg_temp.expect_error($$UPDATE "QuestionProgress" SET "timesCorrect" = 3, "timesSeen" = 1 WHERE id = 'p1'$$, '23514', 'timesSeen must cover graded answers');

-- 7. Quiz: duplicate answer submission for the same quiz question rejected
INSERT INTO "QuizAttempt"(id, "userId", mode, seed, "questionCount") VALUES ('qa1','u1','MIXED',42,2);
INSERT INTO "QuizAttemptQuestion"(id, "quizAttemptId", "questionId", position, "selectionReason") VALUES ('s1','qa1','q1',0,'new'), ('s2','qa1','q2',1,'new');
SELECT pg_temp.expect_error($$INSERT INTO "QuizAttemptQuestion"(id, "quizAttemptId", "questionId", position, "selectionReason") VALUES ('s3','qa1','q1',2,'new')$$,
  '23505', 'same question cannot appear twice in one quiz');
INSERT INTO "QuestionAttempt"(id, "userId", "questionId", "quizAttemptId", kind, "submittedAnswer", correct) VALUES ('a1','u1','q1','qa1','QUIZ','{"x":1}',true);
SELECT pg_temp.expect_error($$INSERT INTO "QuestionAttempt"(id, "userId", "questionId", "quizAttemptId", kind, "submittedAnswer", correct) VALUES ('a2','u1','q1','qa1','QUIZ','{"x":2}',false)$$,
  '23505', 'duplicate quiz answer rejected');
-- Non-quiz attempts (quizAttemptId NULL) may repeat
INSERT INTO "QuestionAttempt"(id, "userId", "questionId", kind, "submittedAnswer") VALUES ('a3','u1','q1','FLASHCARD','{}'), ('a4','u1','q1','FLASHCARD','{}');
SELECT pg_temp.expect(true, 'repeated flashcard attempts allowed');

-- 8. Quiz counters
SELECT pg_temp.expect_error($$UPDATE "QuizAttempt" SET "correctCount" = 2, "gradedCount" = 1 WHERE id = 'qa1'$$, '23514', 'correctCount cannot exceed gradedCount');
SELECT pg_temp.expect_error($$UPDATE "QuizAttempt" SET score = 120 WHERE id = 'qa1'$$, '23514', 'score above 100 rejected');
SELECT pg_temp.expect_error($$INSERT INTO "QuizAttempt"(id, "userId", mode, seed, "questionCount") VALUES ('qa2','u1','NEW',1,0)$$, '23514', 'zero-question quiz rejected');

-- 9. Idempotency key on review logs
INSERT INTO "ReviewLog"(id, "userId", "questionId", rating, kind, "prevIntervalDays", "newIntervalDays", "prevEaseFactor", "newEaseFactor", "idempotencyKey")
  VALUES ('r1','u1','q1','GOOD','FLASHCARD',0,1,2.5,2.5,'k-1');
SELECT pg_temp.expect_error($$INSERT INTO "ReviewLog"(id, "userId", "questionId", rating, kind, "prevIntervalDays", "newIntervalDays", "prevEaseFactor", "newEaseFactor", "idempotencyKey")
  VALUES ('r2','u1','q1','GOOD','FLASHCARD',0,1,2.5,2.5,'k-1')$$, '23505', 'replayed review with same idempotency key rejected');
INSERT INTO "ReviewLog"(id, "userId", "questionId", rating, kind, "prevIntervalDays", "newIntervalDays", "prevEaseFactor", "newEaseFactor", "idempotencyKey")
  VALUES ('r3','u2','q1','GOOD','FLASHCARD',0,1,2.5,2.5,'k-1');
SELECT pg_temp.expect(true, 'idempotency keys are scoped per user');

-- 10. Bookmarks: composite PK
INSERT INTO "Bookmark"("userId", "questionId") VALUES ('u1','q1');
SELECT pg_temp.expect_error($$INSERT INTO "Bookmark"("userId", "questionId") VALUES ('u1','q1')$$, '23505', 'duplicate bookmark rejected');

-- 11. Foreign keys
SELECT pg_temp.expect_error($$INSERT INTO "QuestionProgress"(id, "userId", "questionId", "updatedAt") VALUES ('p9','nobody','q1',now())$$, '23503', 'progress for unknown user rejected');

-- 11b. Lesson prerequisites: a lesson cannot require itself
SELECT pg_temp.expect_error($$INSERT INTO "LessonPrerequisite"("lessonId", "prerequisiteId") VALUES ('l1','l1')$$,
  '23514', 'lesson cannot be its own prerequisite');
INSERT INTO "LessonPrerequisite"("lessonId", "prerequisiteId") VALUES ('l1','l2');
SELECT pg_temp.expect(true, 'distinct-lesson prerequisite allowed');

-- 11c. LessonProgress: understanding range, non-negative counters, correct <= attempts
INSERT INTO "LessonProgress"(id, "userId", "lessonId", "updatedAt") VALUES ('lp1','u1','l1',now());
SELECT pg_temp.expect_error($$UPDATE "LessonProgress" SET understanding = 6 WHERE id = 'lp1'$$, '23514', 'understanding above 5 rejected');
SELECT pg_temp.expect_error($$UPDATE "LessonProgress" SET understanding = 0 WHERE id = 'lp1'$$, '23514', 'understanding below 1 rejected');
UPDATE "LessonProgress" SET understanding = NULL WHERE id = 'lp1';
SELECT pg_temp.expect(true, 'null understanding allowed (not yet self-rated)');
SELECT pg_temp.expect_error($$UPDATE "LessonProgress" SET "practiceAttempts" = -1 WHERE id = 'lp1'$$, '23514', 'negative practice attempts rejected');
SELECT pg_temp.expect_error($$UPDATE "LessonProgress" SET "practiceAttempts" = 1, "practiceCorrect" = 2 WHERE id = 'lp1'$$, '23514', 'practiceCorrect cannot exceed practiceAttempts');

-- 11d. UnfamiliarMark: one open mark per (user, question)
INSERT INTO "UnfamiliarMark"(id, "userId", "questionId", "topicId", "lessonId", source) VALUES ('um1','u1','q1','tp1','l1','QUIZ');
SELECT pg_temp.expect_error($$INSERT INTO "UnfamiliarMark"(id, "userId", "questionId", "topicId", source) VALUES ('um2','u1','q1','tp1','FLASHCARD')$$,
  '23505', 'duplicate unfamiliar mark for the same user and question rejected');

-- 12. Cascades: deleting a user removes all of their private data, but not shared questions
DELETE FROM "User" WHERE id = 'u1';
SELECT pg_temp.expect((SELECT count(*) FROM "QuestionProgress" WHERE "userId" = 'u1') = 0, 'user delete cascades progress');
SELECT pg_temp.expect((SELECT count(*) FROM "QuizAttempt" WHERE "userId" = 'u1') = 0, 'user delete cascades quizzes');
SELECT pg_temp.expect((SELECT count(*) FROM "QuestionAttempt" WHERE "userId" = 'u1') = 0, 'user delete cascades attempts');
SELECT pg_temp.expect((SELECT count(*) FROM "Question" WHERE id = 'q4') = 0, 'user delete cascades their custom cards');
SELECT pg_temp.expect((SELECT count(*) FROM "Question" WHERE id IN ('q1','q2')) = 2, 'shared questions survive user delete');
SELECT pg_temp.expect((SELECT count(*) FROM "QuestionProgress" WHERE "userId" = 'u2') = 1, 'other users'' progress untouched');
SELECT pg_temp.expect((SELECT count(*) FROM "LessonProgress" WHERE id = 'lp1') = 0, 'user delete cascades lesson progress');
SELECT pg_temp.expect((SELECT count(*) FROM "UnfamiliarMark" WHERE id = 'um1') = 0, 'user delete cascades unfamiliar marks');
SELECT pg_temp.expect((SELECT count(*) FROM "Lesson" WHERE id IN ('l1','l2')) = 2, 'lessons survive user delete');

-- 13. Generated question published link: SET NULL when question deleted
INSERT INTO "GeneratedQuestion"(id, kind, "topicId", model, payload, "validationReport", "contentHash", "publishedQuestionId", status)
  VALUES ('g1','VARIATION','tp1','m','{}','{}','h2','q2','APPROVED');
DELETE FROM "Question" WHERE id = 'q2';
SELECT pg_temp.expect((SELECT "publishedQuestionId" FROM "GeneratedQuestion" WHERE id = 'g1') IS NULL, 'deleting a question nulls the generation link');

ROLLBACK;
