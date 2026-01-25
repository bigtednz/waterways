import { Router } from "express";
import { prisma } from "@waterways/db";
import { seasonSchema } from "@waterways/shared";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";

export const seasonsRouter = Router();

seasonsRouter.use(authenticate);

seasonsRouter.get("/", async (req, res, next) => {
  try {
    console.log("Fetching seasons...");
    const seasons = await prisma.season.findMany({
      orderBy: { year: "desc" },
      include: {
        competitions: {
          orderBy: { date: "desc" },
          include: {
            _count: { select: { runResults: true } },
          },
        },
      },
    });
    console.log(`Found ${seasons.length} seasons`);
    res.json(seasons);
  } catch (error) {
    console.error("Error fetching seasons:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if (error.stack) {
        console.error("Error stack:", error.stack);
      }
    }
    next(error);
  }
});

seasonsRouter.get("/:id", async (req, res, next) => {
  try {
    const season = await prisma.season.findUnique({
      where: { id: req.params.id },
      include: {
        competitions: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!season) {
      return res.status(404).json({ error: "Season not found" });
    }

    res.json(season);
  } catch (error) {
    next(error);
  }
});

seasonsRouter.post(
  "/",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = seasonSchema.parse(req.body);
      const season = await prisma.season.create({
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
        },
      });
      res.status(201).json(season);
    } catch (error) {
      next(error);
    }
  }
);

seasonsRouter.put(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = seasonSchema.partial().parse(req.body);
      const season = await prisma.season.update({
        where: { id: req.params.id },
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
      });
      res.json(season);
    } catch (error) {
      next(error);
    }
  }
);

seasonsRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  async (req: AuthRequest, res, next) => {
    try {
      await prisma.season.delete({
        where: { id: req.params.id },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
