-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "forwardConfigId" TEXT,
ADD COLUMN     "forwardError" TEXT,
ADD COLUMN     "forwardStatus" TEXT,
ADD COLUMN     "forwardTarget" TEXT,
ADD COLUMN     "forwarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastReplayStatus" TEXT,
ADD COLUMN     "lastReplayedAt" TIMESTAMP(3),
ADD COLUMN     "replayCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requestSize" INTEGER,
ADD COLUMN     "responseHeaders" TEXT,
ADD COLUMN     "responseSize" INTEGER,
ADD COLUMN     "responseTime" INTEGER;

-- CreateTable
CREATE TABLE "forward_configs" (
    "id" TEXT NOT NULL,
    "proxyPath" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "pathRewrite" TEXT,
    "addHeaders" TEXT,
    "removeHeaders" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "retryDelay" INTEGER NOT NULL DEFAULT 1000,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forward_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_histories" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "replayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetUrl" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseTime" INTEGER,
    "success" BOOLEAN NOT NULL,
    "originalStatusCode" INTEGER,
    "originalResponseTime" INTEGER,
    "responseDiff" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replay_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forward_configs_proxyPath_idx" ON "forward_configs"("proxyPath");

-- CreateIndex
CREATE INDEX "forward_configs_method_idx" ON "forward_configs"("method");

-- CreateIndex
CREATE INDEX "forward_configs_enabled_idx" ON "forward_configs"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "forward_configs_proxyPath_method_key" ON "forward_configs"("proxyPath", "method");

-- CreateIndex
CREATE INDEX "replay_histories_messageId_idx" ON "replay_histories"("messageId");

-- CreateIndex
CREATE INDEX "replay_histories_replayedAt_idx" ON "replay_histories"("replayedAt");

-- CreateIndex
CREATE INDEX "messages_forwarded_idx" ON "messages"("forwarded");

-- CreateIndex
CREATE INDEX "messages_forwardConfigId_idx" ON "messages"("forwardConfigId");

-- CreateIndex
CREATE INDEX "messages_forwardStatus_idx" ON "messages"("forwardStatus");

-- CreateIndex
CREATE INDEX "messages_responseTime_idx" ON "messages"("responseTime");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_forwardConfigId_fkey" FOREIGN KEY ("forwardConfigId") REFERENCES "forward_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_histories" ADD CONSTRAINT "replay_histories_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
