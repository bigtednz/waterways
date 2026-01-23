import { Router } from "express";
import { prisma } from "@waterways/db";
import { competitionSchema } from "@waterways/shared";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";

export const competitionsRouter = Router();

competitionsRouter.use(authenticate);

competitionsRouter.get("/", async (req, res, next) => {
  try {
    const seasonId = req.query.seasonId as string | undefined;
    const competitions = await prisma.competition.findMany({
      where: seasonId ? { seasonId } : undefined,
      include: {
        season: true,
        runResults: {
          include: {
            runType: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });
    res.json(competitions);
  } catch (error) {
    next(error);
  }
});

competitionsRouter.get("/:id", async (req, res, next) => {
  try {
    const competition = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: {
        season: true,
        runResults: {
          include: {
            runType: true,
            penalties: {
              include: {
                penaltyRule: true,
              },
            },
          },
          orderBy: {
            runType: {
              code: "asc",
            },
          },
        },
      },
    });

    if (!competition) {
      return res.status(404).json({ error: "Competition not found" });
    }

    res.json(competition);
  } catch (error) {
    next(error);
  }
});

competitionsRouter.post(
  "/",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = competitionSchema.parse(req.body);
      const competition = await prisma.competition.create({
        data: {
          ...data,
          date: new Date(data.date),
        },
        include: {
          season: true,
        },
      });
      res.status(201).json(competition);
    } catch (error) {
      next(error);
    }
  }
);

competitionsRouter.put(
  "/:id",
  requireRole("ADMIN", "COACH"),
  async (req: AuthRequest, res, next) => {
    try {
      const data = competitionSchema.partial().parse(req.body);
      const competition = await prisma.competition.update({
        where: { id: req.params.id },
        data: {
          ...data,
          date: data.date ? new Date(data.date) : undefined,
        },
        include: {
          season: true,
        },
      });
      res.json(competition);
    } catch (error) {
      next(error);
    }
  }
);

competitionsRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  async (req: AuthRequest, res, next) => {
    try {
      await prisma.competition.delete({
        where: { id: req.params.id },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
