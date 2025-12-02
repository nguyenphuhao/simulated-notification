-- CreateTable
CREATE TABLE "mock_endpoints" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "responseCode" INTEGER NOT NULL DEFAULT 200,
    "responseBody" TEXT NOT NULL,
    "responseHeaders" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mock_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_requests" (
    "id" TEXT NOT NULL,
    "mockEndpointId" TEXT NOT NULL,
    "headers" TEXT NOT NULL,
    "body" TEXT,
    "queryParams" TEXT,
    "pathParams" TEXT,
    "responseCode" INTEGER NOT NULL,
    "responseBody" TEXT,
    "responseHeaders" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mock_endpoints_path_idx" ON "mock_endpoints"("path");

-- CreateIndex
CREATE INDEX "mock_endpoints_method_idx" ON "mock_endpoints"("method");

-- CreateIndex
CREATE INDEX "mock_endpoints_isActive_idx" ON "mock_endpoints"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "mock_endpoints_path_method_key" ON "mock_endpoints"("path", "method");

-- CreateIndex
CREATE INDEX "mock_requests_mockEndpointId_idx" ON "mock_requests"("mockEndpointId");

-- CreateIndex
CREATE INDEX "mock_requests_createdAt_idx" ON "mock_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "mock_requests" ADD CONSTRAINT "mock_requests_mockEndpointId_fkey" FOREIGN KEY ("mockEndpointId") REFERENCES "mock_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
