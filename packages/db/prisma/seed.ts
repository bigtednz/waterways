import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@waterways.com" },
    update: {},
    create: {
      email: "admin@waterways.com",
      password: hashedPassword,
      role: UserRole.ADMIN,
      name: "Admin User",
    },
  });

  // Create run types
  const runTypes = [
    { code: "A1", name: "Run A1" },
    { code: "A3", name: "Run A3" },
    { code: "A5", name: "Run A5" },
    { code: "A7", name: "Run A7" },
    { code: "F9", name: "Run F9" },
    { code: "F11", name: "Run F11" },
    { code: "P13", name: "Run P13" },
    { code: "P15", name: "Run P15" },
    { code: "P17", name: "Run P17" },
  ];

  const createdRunTypes = [];
  for (const rt of runTypes) {
    const runType = await prisma.runType.upsert({
      where: { code: rt.code },
      update: {},
      create: rt,
    });
    createdRunTypes.push(runType);
  }

  // Create season
  const existingSeason = await prisma.season.findFirst({
    where: { year: 2024, name: "2024 Season" },
  });
  
  const season = existingSeason || await prisma.season.create({
    data: {
      name: "2024 Season",
      year: 2024,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
    },
  });

  // Create competition with sample runs
  const existingCompetition = await prisma.competition.findUnique({
    where: { id: "seed-comp-1" },
  });
  
  const competition = existingCompetition || await prisma.competition.create({
    data: {
      id: "seed-comp-1",
      seasonId: season.id,
      name: "Spring Championship",
      date: new Date("2024-03-15"),
      location: "National Waterways Center",
    },
  });

  // Create sample run results for all 9 run types
  const sampleRuns = [
    { runTypeCode: "A1", totalTime: 125.5, penalty: 5.0 },
    { runTypeCode: "A3", totalTime: 118.2, penalty: 0 },
    { runTypeCode: "A5", totalTime: 132.8, penalty: 10.0 },
    { runTypeCode: "A7", totalTime: 115.0, penalty: 0 },
    { runTypeCode: "F9", totalTime: 140.3, penalty: 15.0 },
    { runTypeCode: "F11", totalTime: 128.7, penalty: 0 },
    { runTypeCode: "P13", totalTime: 135.9, penalty: 8.0 },
    { runTypeCode: "P15", totalTime: 122.4, penalty: 0 },
    { runTypeCode: "P17", totalTime: 130.1, penalty: 5.0 },
  ];

  for (const run of sampleRuns) {
    const runType = createdRunTypes.find((rt) => rt.code === run.runTypeCode);
    if (runType) {
      await prisma.runResult.create({
        data: {
          competitionId: competition.id,
          runTypeId: runType.id,
          totalTimeSeconds: run.totalTime,
          penaltySeconds: run.penalty,
          notes: `Sample run for ${run.runTypeCode}`,
          createdById: admin.id,
        },
      });
    }
  }

  // Create sample penalty rules
  const penaltyRules = [
    {
      ruleId: "PEN-001",
      runTypeCode: null, // applies to all
      ruleText: "Failure to follow the designated order chain results in a 5-second penalty per violation.",
      taxonomyCode: "ORDER_VIOLATION",
      severity: "minor",
      outcomeType: "time_penalty",
      outcomeSeconds: 5.0,
      sourcePdfRef: "Section 3.2.1",
    },
    {
      ruleId: "PEN-002",
      runTypeCode: "A1",
      ruleText: "Incorrect procedure execution in Phase 2 results in a 10-second penalty.",
      taxonomyCode: "PROCEDURE_ERROR",
      severity: "major",
      outcomeType: "time_penalty",
      outcomeSeconds: 10.0,
      sourcePdfRef: "Section 4.1.2",
    },
  ];

  for (const rule of penaltyRules) {
    const existing = await prisma.penaltyRule.findUnique({
      where: { ruleId: rule.ruleId },
    });
    if (!existing) {
      await prisma.penaltyRule.create({
        data: rule,
      });
    }
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
