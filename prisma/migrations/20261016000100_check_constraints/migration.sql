-- Hand-written migration: CHECK constraints are not expressible in schema.prisma.
-- Prisma Migrate leaves them alone (they are not reported as drift).

ALTER TABLE "QuestionProgress"
  ADD CONSTRAINT "QuestionProgress_ease_floor_chk" CHECK ("easeFactor" >= 1.3),
  ADD CONSTRAINT "QuestionProgress_interval_nonneg_chk" CHECK ("intervalDays" >= 0),
  ADD CONSTRAINT "QuestionProgress_counters_nonneg_chk" CHECK (
    "repetitions" >= 0 AND "lapses" >= 0 AND "timesSeen" >= 0 AND "timesCorrect" >= 0
    AND "timesIncorrect" >= 0 AND "consecutiveCorrect" >= 0
  ),
  ADD CONSTRAINT "QuestionProgress_seen_covers_graded_chk" CHECK ("timesSeen" >= "timesCorrect" + "timesIncorrect");

ALTER TABLE "QuizAttempt"
  ADD CONSTRAINT "QuizAttempt_score_range_chk" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)),
  ADD CONSTRAINT "QuizAttempt_counts_chk" CHECK (
    "questionCount" BETWEEN 1 AND 100 AND "correctCount" >= 0 AND "gradedCount" >= 0
    AND "correctCount" <= "gradedCount" AND "gradedCount" <= "questionCount"
  );

ALTER TABLE "UserSettings"
  ADD CONSTRAINT "UserSettings_daily_goal_chk" CHECK ("dailyGoal" BETWEEN 1 AND 500),
  ADD CONSTRAINT "UserSettings_recent_window_chk" CHECK ("recentWindowHours" BETWEEN 0 AND 720);

ALTER TABLE "InterviewResponse"
  ADD CONSTRAINT "InterviewResponse_score_range_chk" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100));

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_owner_scope_chk" CHECK (
    ("ownerId" IS NULL AND "dedupeScope" = 'global') OR ("ownerId" IS NOT NULL AND "dedupeScope" = "ownerId")
  );
