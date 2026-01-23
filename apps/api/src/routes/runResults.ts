import { Router } from "express";
import { prisma } from "@waterways/db";
import { runResultSchema, bulkRunResultSchema } from "@waterways/shared";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";

export const runResultsRouter = Router();

runResultsRouter.use(authenticate);

runResultsRouter.get("/", async (req, res, next) => {
  try {
    const competitionId = req.query.competitionId as string | undefined;
    const runTypeId = req.query.runTypeId as string | undefined;

    const runResults = await prisma.runResult.findMany({
      where: {
        competitionId: competitionId || undefined,
        runTypeId: runTypeId || undefined,
      },
      include: {
        runType: true,
        competition: true,
        penalties: {
          include: {
            penaltyRule: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(runResults);
  } catch (error) {
    next(error);
  }
});

runResultsRouter.get("/:id", async (req, res, next) => {
  try {
    const runResult = await prisma.runResult.findUnique({
      where: { id: req.params.id },
      include: {
        runType: true,
        competition: true,
        penalties: {
          include: {
            penaltyRule: true,
          },
        },
      },
    });

    if (!runResult) {
      return res.status(404).json({ error: "Run result not found" });
    }

    res.json(runResult);
  } catch (error) {
    next(error);
  }
});

runResultsRouter.post(
  "/",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = runResultSchema.parse(req.body);
      const runResult = await prisma.runResult.create({
        data: {
          ...data,
          createdById: req.userId!,
        },
        include: {
          runType: true,
          competition: true,
        },
      });
      res.status(201).json(runResult);
    } catch (error) {
      next(error);
    }
  }
);

runResultsRouter.post(
  "/bulk",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const { competitionId, runs } = bulkRunResultSchema.parse(req.body);

      const runTypes = await prisma.runType.findMany();
      const runTypeMap = new Map(runTypes.map((rt) => [rt.code, rt.id]));

      const results = await Promise.all(
        runs.map(async (run) => {
          const runTypeId = runTypeMap.get(run.runTypeCode);
          if (!runTypeId) {
            throw new Error(`Run type ${run.runTypeCode} not found`);
          }

          return prisma.runResult.create({
            data: {
              competitionId,
              runTypeId,
              totalTimeSeconds: run.totalTimeSeconds,
              penaltySeconds: run.penaltySeconds || 0,
              notes: run.notes,
              createdById: req.userId!,
            },
            include: {
              runType: true,
            },
          });
        })
      );

      res.status(201).json(results);
    } catch (error) {
      next(error);
    }
  }
);

runResultsRouter.put(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = runResultSchema.partial().parse(req.body);
      const runResult = await prisma.runResult.update({
        where: { id: req.params.id },
        data,
        include: {
          runType: true,
          competition: true,
        },
      });
      res.json(runResult);
    } catch (error) {
      next(error);
    }
  }
);

runResultsRouter.delete(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      await prisma.runResult.delete({
        where: { id: req.params.id },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
