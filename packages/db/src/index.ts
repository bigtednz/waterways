import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma: PrismaClient;

try {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }
  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });
} catch (error) {
  console.error("Failed to initialize Prisma Client:", error);
  console.error("This usually means Prisma client needs to be regenerated or DATABASE_URL is missing.");
  console.error("Run: npm run db:generate");
  throw error;
}

export { prisma };
export * from "./generated/prisma/client.js";
