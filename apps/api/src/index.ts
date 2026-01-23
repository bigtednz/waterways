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

dotenv.config();

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

app.use("/api/auth", authRouter);
app.use("/api/seasons", seasonsRouter);
app.use("/api/competitions", competitionsRouter);
app.use("/api/run-types", runTypesRouter);
app.use("/api/run-results", runResultsRouter);
app.use("/api/run-specs", runSpecsRouter);
app.use("/api/penalty-rules", penaltyRulesRouter);
app.use("/api/analytics", analyticsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
