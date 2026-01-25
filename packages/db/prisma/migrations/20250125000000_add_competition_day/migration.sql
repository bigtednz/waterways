-- CreateEnum
CREATE TYPE "RunQueueStatus" AS ENUM ('PLANNED', 'RUN', 'SKIPPED');

-- CreateTable
CREATE TABLE "competition_days" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "challengeName" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "trackName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_queue_items" (
    "id" TEXT NOT NULL,
    "competitionDayId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "eventCode" TEXT NOT NULL,
    "status" "RunQueueStatus" NOT NULL DEFAULT 'PLANNED',
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_queue_items_competitionDayId_idx" ON "run_queue_items"("competitionDayId");

-- CreateIndex
CREATE UNIQUE INDEX "run_queue_items_competitionDayId_sequenceNo_key" ON "run_queue_items"("competitionDayId", "sequenceNo");

-- AddForeignKey
ALTER TABLE "run_queue_items" ADD CONSTRAINT "run_queue_items_competitionDayId_fkey" FOREIGN KEY ("competitionDayId") REFERENCES "competition_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
