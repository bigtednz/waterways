-- AlterTable: Make totalTimeSeconds optional and add ran field
ALTER TABLE "competitor_times" 
  ALTER COLUMN "totalTimeSeconds" DROP NOT NULL,
  ADD COLUMN "ran" BOOLEAN NOT NULL DEFAULT true;
