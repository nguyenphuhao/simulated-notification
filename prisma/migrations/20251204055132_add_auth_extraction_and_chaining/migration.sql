-- AlterTable
ALTER TABLE "forward_configs" ADD COLUMN     "extractTokenFrom" TEXT,
ADD COLUMN     "nextForwardConfigId" TEXT,
ADD COLUMN     "tokenHeaderName" TEXT,
ADD COLUMN     "tokenPath" TEXT;

-- CreateIndex
CREATE INDEX "forward_configs_nextForwardConfigId_idx" ON "forward_configs"("nextForwardConfigId");

-- AddForeignKey
ALTER TABLE "forward_configs" ADD CONSTRAINT "forward_configs_nextForwardConfigId_fkey" FOREIGN KEY ("nextForwardConfigId") REFERENCES "forward_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
