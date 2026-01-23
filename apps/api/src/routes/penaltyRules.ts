import { Router } from "express";
import { prisma } from "@waterways/db";
import { authenticate } from "../middleware/auth.js";

export const penaltyRulesRouter = Router();

penaltyRulesRouter.use(authenticate);

penaltyRulesRouter.get("/", async (req, res, next) => {
  try {
    const runTypeCode = req.query.runTypeCode as string | undefined;

    const penaltyRules = await prisma.penaltyRule.findMany({
      where: runTypeCode
        ? {
            OR: [{ runTypeCode }, { runTypeCode: null }],
          }
        : undefined,
      include: {
        runType: true,
      },
      orderBy: { ruleId: "asc" },
    });

    res.json(penaltyRules);
  } catch (error) {
    next(error);
  }
});

penaltyRulesRouter.get("/:id", async (req, res, next) => {
  try {
    const penaltyRule = await prisma.penaltyRule.findUnique({
      where: { id: req.params.id },
      include: {
        runType: true,
      },
    });

    if (!penaltyRule) {
      return res.status(404).json({ error: "Penalty rule not found" });
    }

    res.json(penaltyRule);
  } catch (error) {
    next(error);
  }
});
