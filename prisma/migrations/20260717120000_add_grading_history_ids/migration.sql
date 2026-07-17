ALTER TABLE "Submission"
ADD COLUMN "requestId" TEXT,
ADD COLUMN "workflowRunId" TEXT;

CREATE INDEX "Submission_requestId_idx" ON "Submission"("requestId");
CREATE INDEX "Submission_workflowRunId_idx" ON "Submission"("workflowRunId");
