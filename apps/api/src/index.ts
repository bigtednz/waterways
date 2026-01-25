import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { authRouter } from "./routes/auth.js";
import { seasonsRouter } from "./routes/seasons.js";
import { competitionsRouter } from "./routes/competitions.js";
import { competitionDaysRouter } from "./routes/competitionDays.js";
import { runTypesRouter } from "./routes/runTypes.js";
import { runResultsRouter } from "./routes/runResults.js";
import { runSpecsRouter } from "./routes/runSpecs.js";
import { penaltyRulesRouter } from "./routes/penaltyRules.js";
import { penaltyInterpretationRouter } from "./routes/penaltyInterpretation.js";
import { analyticsRouter } from "./routes/analytics.js";
import { scenariosRouter } from "./routes/scenarios.js";
import { usersRouter } from "./routes/users.js";
import { supportRouter } from "./routes/support.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { prisma } from "@waterways/db";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// Railway sets PORT automatically, fallback to API_PORT or default
const PORT = process.env.PORT || process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// Root route - show API info in dev, serve frontend in production
app.get("/", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    // In production, try to serve the frontend
    const indexPath = path.join(__dirname, "../../web/dist/index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        // If frontend not found, show API info as fallback
        res.json({ 
          message: "Waterways API",
          version: "1.0.0",
          note: "Frontend not found - check build logs",
          endpoints: {
            health: "/health",
            auth: "/api/auth",
            seasons: "/api/seasons",
            competitions: "/api/competitions"
          }
        });
      }
    });
  } else {
    // Development: show API info
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
        analytics: "/api/analytics",
        scenarios: "/api/scenarios"
      }
    });
  }
});

app.get("/health", async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

// Debug endpoint to test database connection
app.get("/api/debug/test-db", async (req, res) => {
  try {
    // Test basic connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test if users table exists
    const userCount = await prisma.user.count();
    
    res.json({
      success: true,
      database: "connected",
      usersTable: "exists",
      userCount,
      prismaClient: "working",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      name: error.name,
      meta: error.meta,
    });
  }
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
app.use("/api/competition-days", competitionDaysRouter);
app.use("/api/run-types", runTypesRouter);
app.use("/api/run-results", runResultsRouter);
app.use("/api/run-specs", runSpecsRouter);
app.use("/api/penalty-rules", penaltyRulesRouter);
app.use("/api/penalties", penaltyInterpretationRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/scenarios", scenariosRouter);
app.use("/api/users", usersRouter);
app.use("/api/support", supportRouter);

app.use(errorHandler);

// Serve static files from web app (must be after API routes)
// From apps/api/dist, go up to apps/, then into web/dist
const webDistPath = path.join(__dirname, "../../web/dist");
const isProduction = process.env.NODE_ENV === "production";

console.log(`NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
console.log(`__dirname: ${__dirname}`);
console.log(`Web dist path: ${webDistPath}`);
console.log(`Web dist exists: ${existsSync(webDistPath)}`);

// Always try to serve static files if they exist
if (existsSync(webDistPath)) {
  console.log(`✅ Serving static files from: ${webDistPath}`);
  app.use(express.static(webDistPath));
} else {
  console.warn(`⚠️ Web dist directory not found at: ${webDistPath}`);
  console.warn(`⚠️ Frontend will not be served. Check that the web app was built.`);
}

// Serve index.html for all non-API routes (SPA fallback)
app.get("*", (req, res, next) => {
  // Skip API routes and health check
  if (req.path.startsWith("/api") || req.path === "/health") {
    return next();
  }
  
  const indexPath = path.join(webDistPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Error serving index.html:", err.message);
      // If frontend not found, return helpful error
      res.status(404).json({ 
        error: "Frontend not found",
        message: "The frontend build may not exist. Check that the web app was built successfully.",
        path: indexPath,
        nodeEnv: process.env.NODE_ENV || "not set",
        apiEndpoints: {
          health: "/health",
          auth: "/api/auth",
          seasons: "/api/seasons",
          competitions: "/api/competitions"
        }
      });
    }
  });
});

// Ensure database is seeded before starting server
ensureSeeded().then(() => {
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
});
