CREATE TABLE "GradingConversation" (
  "id" TEXT NOT NULL,
  "gradingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GradingConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GradingMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradingConversation_gradingId_userId_key" ON "GradingConversation"("gradingId", "userId");
CREATE INDEX "GradingConversation_userId_updatedAt_idx" ON "GradingConversation"("userId", "updatedAt");
CREATE INDEX "GradingMessage_conversationId_createdAt_idx" ON "GradingMessage"("conversationId", "createdAt");

ALTER TABLE "GradingConversation" ADD CONSTRAINT "GradingConversation_gradingId_fkey"
  FOREIGN KEY ("gradingId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradingConversation" ADD CONSTRAINT "GradingConversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradingMessage" ADD CONSTRAINT "GradingMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "GradingConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
