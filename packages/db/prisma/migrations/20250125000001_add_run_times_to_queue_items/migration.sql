-- AlterTable
ALTER TABLE "run_queue_items" ADD COLUMN "totalTimeSeconds" DOUBLE PRECISION,
ADD COLUMN "penaltySeconds" DOUBLE PRECISION DEFAULT 0;
