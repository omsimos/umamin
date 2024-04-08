-- DropIndex
DROP INDEX "GlobalMessage_userId_updatedAt_idx";

-- CreateIndex
CREATE INDEX "GlobalMessage_userId_idx" ON "GlobalMessage"("userId");

-- CreateIndex
CREATE INDEX "GlobalMessage_updatedAt_idx" ON "GlobalMessage"("updatedAt" DESC);
