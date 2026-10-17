-- CreateEnum
CREATE TYPE "CodeLanguage" AS ENUM ('TYPESCRIPT', 'SQL', 'HTTP', 'BASH');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "UnfamiliarSource" AS ENUM ('FLASHCARD', 'QUIZ', 'INTERVIEW');

-- AlterEnum: lesson practice answers feed the same per-question schedule as quizzes, under their own kind.
ALTER TYPE "StudyKind" ADD VALUE 'LESSON_PRACTICE';

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "codeExample" TEXT,
ADD COLUMN     "codeLanguage" "CodeLanguage",
ADD COLUMN     "commonMistakes" TEXT,
ADD COLUMN     "estimatedMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "level" "Difficulty" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "realWorldExample" TEXT,
ADD COLUMN     "summary" TEXT;

-- CreateTable
CREATE TABLE "LessonPrerequisite" (
    "lessonId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,

    CONSTRAINT "LessonPrerequisite_pkey" PRIMARY KEY ("lessonId","prerequisiteId")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "understanding" INTEGER,
    "practiceAttempts" INTEGER NOT NULL DEFAULT 0,
    "practiceCorrect" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnfamiliarMark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "lessonId" TEXT,
    "source" "UnfamiliarSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "UnfamiliarMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonPrerequisite_prerequisiteId_idx" ON "LessonPrerequisite"("prerequisiteId");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_status_idx" ON "LessonProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "UnfamiliarMark_userId_resolvedAt_idx" ON "UnfamiliarMark"("userId", "resolvedAt");

-- CreateIndex
CREATE INDEX "UnfamiliarMark_lessonId_idx" ON "UnfamiliarMark"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "UnfamiliarMark_userId_questionId_key" ON "UnfamiliarMark"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "LessonPrerequisite" ADD CONSTRAINT "LessonPrerequisite_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPrerequisite" ADD CONSTRAINT "LessonPrerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnfamiliarMark" ADD CONSTRAINT "UnfamiliarMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnfamiliarMark" ADD CONSTRAINT "UnfamiliarMark_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnfamiliarMark" ADD CONSTRAINT "UnfamiliarMark_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnfamiliarMark" ADD CONSTRAINT "UnfamiliarMark_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: Prisma cannot express these; hand-written like 20261016000100_check_constraints.
ALTER TABLE "LessonPrerequisite" ADD CONSTRAINT "LessonPrerequisite_not_self" CHECK ("lessonId" <> "prerequisiteId");

ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_understanding_range" CHECK ("understanding" IS NULL OR ("understanding" >= 1 AND "understanding" <= 5));
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_practiceAttempts_nonneg" CHECK ("practiceAttempts" >= 0);
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_practiceCorrect_nonneg" CHECK ("practiceCorrect" >= 0);
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_practiceCorrect_le_attempts" CHECK ("practiceCorrect" <= "practiceAttempts");
