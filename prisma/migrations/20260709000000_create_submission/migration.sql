CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL DEFAULT '匿名学生',
    "studentId" TEXT,
    "courseName" TEXT NOT NULL DEFAULT '工程课程',
    "className" TEXT,
    "problemImageName" TEXT NOT NULL,
    "answerImageName" TEXT NOT NULL,
    "problemOcr" TEXT,
    "answerOcr" TEXT,
    "problemDiagram" TEXT,
    "answerDiagram" TEXT,
    "gradingResult" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "firstError" TEXT,
    "errorType" TEXT,
    "knowledgePoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Submission_createdAt_idx" ON "Submission"("createdAt");
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");
CREATE INDEX "Submission_studentName_idx" ON "Submission"("studentName");
CREATE INDEX "Submission_errorType_idx" ON "Submission"("errorType");
CREATE INDEX "Submission_knowledgePoint_idx" ON "Submission"("knowledgePoint");
