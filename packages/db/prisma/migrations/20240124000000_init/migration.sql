-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COACH', 'VIEWER');

-- CreateEnum
CREATE TYPE "ScenarioScopeType" AS ENUM ('SEASON', 'COMPETITION', 'RUN_TYPE', 'RUN_RESULT');

-- CreateEnum
CREATE TYPE "ScenarioAdjustmentType" AS ENUM ('REMOVE_PENALTY_TAXONOMY', 'OVERRIDE_PENALTY_SECONDS', 'CLEAN_TIME_DELTA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_results" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "runTypeId" TEXT NOT NULL,
    "totalTimeSeconds" DOUBLE PRECISION NOT NULL,
    "penaltySeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_specs" (
    "id" TEXT NOT NULL,
    "runTypeId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "jsonSpec" JSONB NOT NULL,
    "markdownPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_rules" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "runTypeCode" TEXT,
    "ruleText" TEXT NOT NULL,
    "taxonomyCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "outcomeType" TEXT NOT NULL,
    "outcomeSeconds" DOUBLE PRECISION,
    "sourcePdfRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_penalties" (
    "id" TEXT NOT NULL,
    "runResultId" TEXT NOT NULL,
    "penaltyRuleId" TEXT NOT NULL,
    "secondsApplied" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "linkedTaxonomyCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "runResultId" TEXT,
    "runTypeId" TEXT,
    "text" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_runs" (
    "id" TEXT NOT NULL,
    "analyticsVersion" TEXT NOT NULL,
    "computationType" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "scenarioId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "durationMs" INTEGER,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_artifacts" (
    "id" TEXT NOT NULL,
    "analyticsRunId" TEXT NOT NULL,
    "analyticsVersion" TEXT NOT NULL,
    "artifactKey" TEXT NOT NULL,
    "outputJson" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_adjustments" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "scopeType" "ScenarioScopeType" NOT NULL,
    "scopeId" TEXT,
    "adjustmentType" "ScenarioAdjustmentType" NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenario_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_year_name_key" ON "seasons"("year", "name");

-- CreateIndex
CREATE UNIQUE INDEX "run_types_code_key" ON "run_types"("code");

-- CreateIndex
CREATE INDEX "run_results_competitionId_idx" ON "run_results"("competitionId");

-- CreateIndex
CREATE INDEX "run_results_runTypeId_idx" ON "run_results"("runTypeId");

-- CreateIndex
CREATE INDEX "run_results_createdAt_idx" ON "run_results"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "run_specs_runTypeId_version_key" ON "run_specs"("runTypeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_rules_ruleId_key" ON "penalty_rules"("ruleId");

-- CreateIndex
CREATE INDEX "penalty_rules_runTypeCode_idx" ON "penalty_rules"("runTypeCode");

-- CreateIndex
CREATE INDEX "penalty_rules_taxonomyCode_idx" ON "penalty_rules"("taxonomyCode");

-- CreateIndex
CREATE INDEX "run_penalties_runResultId_idx" ON "run_penalties"("runResultId");

-- CreateIndex
CREATE INDEX "prescriptions_runResultId_idx" ON "prescriptions"("runResultId");

-- CreateIndex
CREATE INDEX "prescriptions_runTypeId_idx" ON "prescriptions"("runTypeId");

-- CreateIndex
CREATE INDEX "analytics_runs_analyticsVersion_idx" ON "analytics_runs"("analyticsVersion");

-- CreateIndex
CREATE INDEX "analytics_runs_computationType_idx" ON "analytics_runs"("computationType");

-- CreateIndex
CREATE INDEX "analytics_runs_scenarioId_idx" ON "analytics_runs"("scenarioId");

-- CreateIndex
CREATE INDEX "analytics_runs_runAt_idx" ON "analytics_runs"("runAt");

-- CreateIndex
CREATE INDEX "analytics_artifacts_artifactKey_idx" ON "analytics_artifacts"("artifactKey");

-- CreateIndex
CREATE INDEX "analytics_artifacts_analyticsVersion_idx" ON "analytics_artifacts"("analyticsVersion");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_artifacts_analyticsRunId_artifactKey_key" ON "analytics_artifacts"("analyticsRunId", "artifactKey");

-- CreateIndex
CREATE INDEX "scenario_adjustments_scenarioId_idx" ON "scenario_adjustments"("scenarioId");

-- CreateIndex
CREATE INDEX "scenario_adjustments_scopeType_scopeId_idx" ON "scenario_adjustments"("scopeType", "scopeId");

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_results" ADD CONSTRAINT "run_results_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_results" ADD CONSTRAINT "run_results_runTypeId_fkey" FOREIGN KEY ("runTypeId") REFERENCES "run_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_results" ADD CONSTRAINT "run_results_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_specs" ADD CONSTRAINT "run_specs_runTypeId_fkey" FOREIGN KEY ("runTypeId") REFERENCES "run_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_rules" ADD CONSTRAINT "penalty_rules_runTypeCode_fkey" FOREIGN KEY ("runTypeCode") REFERENCES "run_types"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_penalties" ADD CONSTRAINT "run_penalties_runResultId_fkey" FOREIGN KEY ("runResultId") REFERENCES "run_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_penalties" ADD CONSTRAINT "run_penalties_penaltyRuleId_fkey" FOREIGN KEY ("penaltyRuleId") REFERENCES "penalty_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_runResultId_fkey" FOREIGN KEY ("runResultId") REFERENCES "run_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_runTypeId_fkey" FOREIGN KEY ("runTypeId") REFERENCES "run_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_runs" ADD CONSTRAINT "analytics_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_runs" ADD CONSTRAINT "analytics_runs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_artifacts" ADD CONSTRAINT "analytics_artifacts_analyticsRunId_fkey" FOREIGN KEY ("analyticsRunId") REFERENCES "analytics_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_adjustments" ADD CONSTRAINT "scenario_adjustments_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

