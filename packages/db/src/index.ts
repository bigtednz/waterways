import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
} catch (error) {
  console.error("Failed to initialize Prisma Client:", error);
  console.error("This usually means Prisma client needs to be regenerated.");
  console.error("Run: npm run db:generate");
  throw error;
}

export { prisma };
export * from "@prisma/client";
