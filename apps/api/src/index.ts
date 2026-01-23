import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authRouter } from "./routes/auth.js";
import { seasonsRouter } from "./routes/seasons.js";
import { competitionsRouter } from "./routes/competitions.js";
import { runTypesRouter } from "./routes/runTypes.js";
import { runResultsRouter } from "./routes/runResults.js";
import { runSpecsRouter } from "./routes/runSpecs.js";
import { penaltyRulesRouter } from "./routes/penaltyRules.js";
import { analyticsRouter } from "./routes/analytics.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { prisma } from "@waterways/db";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

dotenv.config();

// Seed database on startup if admin user doesn't exist
async function ensureSeeded() {
  try {
    console.log("Checking for admin user...");
    const adminExists = await prisma.user.findUnique({
      where: { email: "admin@waterways.com" },
    });

    if (!adminExists) {
      console.log("Admin user not found. Creating admin user...");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = await prisma.user.upsert({
        where: { email: "admin@waterways.com" },
        update: {
          password: hashedPassword, // Reset password if user exists but password was changed
          role: UserRole.ADMIN,
        },
        create: {
          email: "admin@waterways.com",
          password: hashedPassword,
          role: UserRole.ADMIN,
          name: "Admin User",
        },
      });
      console.log("✅ Admin user created/updated: admin@waterways.com / admin123");
      console.log("Admin ID:", admin.id);
    } else {
      console.log("✅ Admin user already exists: admin@waterways.com");
    }
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    // Don't fail startup if seeding fails
  }
}

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ 
    message: "Waterways API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      seasons: "/api/seasons",
      competitions: "/api/competitions",
      runTypes: "/api/run-types",
      runResults: "/api/run-results",
      analytics: "/api/analytics"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Debug endpoint to check/reset admin user (remove in production)
app.post("/api/debug/reset-admin", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const admin = await prisma.user.upsert({
      where: { email: "admin@waterways.com" },
      update: {
        password: hashedPassword,
        role: UserRole.ADMIN,
        name: "Admin User",
      },
      create: {
        email: "admin@waterways.com",
        password: hashedPassword,
        role: UserRole.ADMIN,
        name: "Admin User",
      },
    });
    res.json({ 
      success: true, 
      message: "Admin user reset",
      email: admin.email,
      id: admin.id 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/seasons", seasonsRouter);
app.use("/api/competitions", competitionsRouter);
app.use("/api/run-types", runTypesRouter);
app.use("/api/run-results", runResultsRouter);
app.use("/api/run-specs", runSpecsRouter);
app.use("/api/penalty-rules", penaltyRulesRouter);
app.use("/api/analytics", analyticsRouter);

app.use(errorHandler);

// Ensure database is seeded before starting server
ensureSeeded().then(() => {
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
});
