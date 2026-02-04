-- AlterTable: Add splitTimes to run_queue_items
ALTER TABLE "run_queue_items" ADD COLUMN "splitTimes" JSONB;

-- CreateTable: CompetitorTime
CREATE TABLE "competitor_times" (
    "id" TEXT NOT NULL,
    "queueItemId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "totalTimeSeconds" DOUBLE PRECISION NOT NULL,
    "penaltySeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "splitTimes" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_times_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competitor_times_queueItemId_idx" ON "competitor_times"("queueItemId");

-- AddForeignKey
ALTER TABLE "competitor_times" ADD CONSTRAINT "competitor_times_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "run_queue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
