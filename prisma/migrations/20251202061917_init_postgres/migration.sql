-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "provider" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "headers" TEXT NOT NULL,
    "body" TEXT,
    "queryParams" TEXT,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purge_config" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "maxMessages" INTEGER NOT NULL DEFAULT 500,
    "lastPurgedAt" TIMESTAMP(3),

    CONSTRAINT "purge_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" TEXT,
    "requestUrl" TEXT,
    "requestMethod" TEXT,
    "requestHeaders" TEXT,
    "requestBody" TEXT,
    "responseStatus" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_category_idx" ON "messages"("category");

-- CreateIndex
CREATE INDEX "messages_provider_idx" ON "messages"("provider");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "messages_category_createdAt_idx" ON "messages"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "purge_config_category_key" ON "purge_config"("category");

-- CreateIndex
CREATE INDEX "error_logs_level_idx" ON "error_logs"("level");

-- CreateIndex
CREATE INDEX "error_logs_source_idx" ON "error_logs"("source");

-- CreateIndex
CREATE INDEX "error_logs_createdAt_idx" ON "error_logs"("createdAt");

-- CreateIndex
CREATE INDEX "error_logs_level_createdAt_idx" ON "error_logs"("level", "createdAt");
