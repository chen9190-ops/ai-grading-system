BEGIN;

CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
CREATE TYPE "AIConversationType" AS ENUM ('MECHANICS_ASSISTANT', 'EXAM_GENERATOR', 'TEACHING_REPORT');

ALTER TABLE "Submission" ADD COLUMN "aiResult" JSONB,
ADD COLUMN "answerImages" JSONB,
ADD COLUMN "assignmentName" TEXT,
ADD COLUMN "feedback" TEXT,
ADD COLUMN "problemImages" JSONB,
ADD COLUMN "userId" TEXT;

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "major" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Course" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamPaper" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "courseName" TEXT NOT NULL,
  "chapter" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "questionCount" INTEGER NOT NULL,
  "questions" JSONB NOT NULL,
  "answer" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamPaper_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIConversation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AIConversationType" NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "knowledgeUsed" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingReport" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "courseName" TEXT NOT NULL,
  "inputData" JSONB NOT NULL,
  "report" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeachingReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");
CREATE UNIQUE INDEX "StudentProfile_studentId_key" ON "StudentProfile"("studentId");
CREATE INDEX "StudentProfile_className_idx" ON "StudentProfile"("className");
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");
CREATE UNIQUE INDEX "TeacherProfile_teacherId_key" ON "TeacherProfile"("teacherId");
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");
CREATE INDEX "Course_name_idx" ON "Course"("name");
CREATE INDEX "ExamPaper_teacherId_createdAt_idx" ON "ExamPaper"("teacherId", "createdAt");
CREATE INDEX "ExamPaper_courseName_idx" ON "ExamPaper"("courseName");
CREATE INDEX "AIConversation_userId_type_createdAt_idx" ON "AIConversation"("userId", "type", "createdAt");
CREATE INDEX "TeachingReport_teacherId_createdAt_idx" ON "TeachingReport"("teacherId", "createdAt");
CREATE INDEX "TeachingReport_courseName_idx" ON "TeachingReport"("courseName");
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamPaper" ADD CONSTRAINT "ExamPaper_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingReport" ADD CONSTRAINT "TeachingReport_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
