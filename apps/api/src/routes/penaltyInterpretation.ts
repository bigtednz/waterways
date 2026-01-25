import { Router } from "express";
import { prisma } from "@waterways/db";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { interpretPenaltyNotes } from "@waterways/shared";
import type { A1RunSpec } from "@waterways/shared";

export const penaltyInterpretationRouter = Router();

penaltyInterpretationRouter.use(authenticate);

/**
 * POST /api/penalties/interpret
 * Interpret penalty notes and link to run specification
 * 
 * Body: {
 *   runTypeCode: string;
 *   notes: string;
 *   seasonId?: string;
 *   competitionId?: string;
 *   runResultId?: string;
 * }
 */
penaltyInterpretationRouter.post("/interpret", async (req: AuthRequest, res, next) => {
  try {
    const { runTypeCode, notes, seasonId, competitionId, runResultId } = req.body;

    if (!runTypeCode) {
      return res.status(400).json({ error: "runTypeCode is required" });
    }

    if (!notes || typeof notes !== "string") {
      return res.status(400).json({ error: "notes is required and must be a string" });
    }

    // Load run type
    const runType = await prisma.runType.findUnique({
      where: { code: runTypeCode },
    });

    if (!runType) {
      return res.status(404).json({ error: `Run type ${runTypeCode} not found` });
    }

    // Load latest run spec
    const runSpec = await prisma.runSpec.findFirst({
      where: { runTypeId: runType.id },
      orderBy: { version: "desc" },
    });

    if (!runSpec) {
      return res.status(404).json({ 
        error: `No specification found for run type ${runTypeCode}`,
        message: "Add a specification via the Admin page to enable penalty interpretation"
      });
    }

    // Parse spec JSON
    const specJson = runSpec.jsonSpec as unknown as A1RunSpec;

    // Interpret notes
    const interpretation = interpretPenaltyNotes(notes, specJson, runTypeCode);

    // Return interpretation result
    res.json({
      runTypeCode,
      runTypeName: runType.name,
      specVersion: runSpec.version,
      interpretation,
      metadata: {
        seasonId: seasonId || null,
        competitionId: competitionId || null,
        runResultId: runResultId || null,
      },
    });
  } catch (error) {
    next(error);
  }
});
