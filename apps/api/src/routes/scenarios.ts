import { Router } from "express";
import { prisma } from "@waterways/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";
import { scenarioSchema, scenarioAdjustmentSchema } from "@waterways/shared";

export const scenariosRouter = Router();

scenariosRouter.use(authenticate);

// List scenarios
scenariosRouter.get("/", async (req, res, next) => {
  try {
    const scenarios = await prisma.scenario.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            adjustments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(scenarios);
  } catch (error) {
    next(error);
  }
});

// Get scenario by ID with adjustments
scenariosRouter.get("/:id", async (req, res, next) => {
  try {
    const scenario = await prisma.scenario.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        adjustments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    res.json(scenario);
  } catch (error) {
    next(error);
  }
});

// Create scenario
scenariosRouter.post(
  "/",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = scenarioSchema.parse(req.body);
      const scenario = await prisma.scenario.create({
        data: {
          ...data,
          createdById: req.userId || null,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json(scenario);
    } catch (error) {
      next(error);
    }
  }
);

// Update scenario
scenariosRouter.put(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = scenarioSchema.partial().parse(req.body);
      const scenario = await prisma.scenario.update({
        where: { id: req.params.id },
        data,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      res.json(scenario);
    } catch (error) {
      next(error);
    }
  }
);

// Delete scenario
scenariosRouter.delete(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      await prisma.scenario.delete({
        where: { id: req.params.id },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// Add adjustment to scenario
scenariosRouter.post(
  "/:id/adjustments",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const scenarioId = req.params.id;

      // Verify scenario exists
      const scenario = await prisma.scenario.findUnique({
        where: { id: scenarioId },
      });

      if (!scenario) {
        return res.status(404).json({ error: "Scenario not found" });
      }

      const data = scenarioAdjustmentSchema.parse(req.body);
      const adjustment = await prisma.scenarioAdjustment.create({
        data: {
          ...data,
          scenarioId,
        },
      });

      res.status(201).json(adjustment);
    } catch (error) {
      next(error);
    }
  }
);

// Delete adjustment
scenariosRouter.delete(
  "/:id/adjustments/:adjustmentId",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      await prisma.scenarioAdjustment.delete({
        where: { id: req.params.adjustmentId },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
