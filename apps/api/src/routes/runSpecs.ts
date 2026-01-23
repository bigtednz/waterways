import { Router } from "express";
import { prisma } from "@waterways/db";
import { authenticate } from "../middleware/auth.js";

export const runSpecsRouter = Router();

runSpecsRouter.use(authenticate);

runSpecsRouter.get("/:runTypeCode", async (req, res, next) => {
  try {
    const runType = await prisma.runType.findUnique({
      where: { code: req.params.runTypeCode },
      include: {
        runSpecs: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!runType) {
      return res.status(404).json({ error: "Run type not found" });
    }

    const latestSpec = runType.runSpecs[0] || null;
    res.json({
      runType: {
        id: runType.id,
        code: runType.code,
        name: runType.name,
      },
      spec: latestSpec,
    });
  } catch (error) {
    next(error);
  }
});
